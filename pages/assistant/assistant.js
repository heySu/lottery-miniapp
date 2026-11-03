const { cloud, chatCompletionFallback } = require('../../utils/cloud');
const { applyTab } = require('../../utils/tab-helper');
const { getGame, recentDraws, frequency, omissions, pad, DATA_UPDATED_AT } = require('../../utils/lottery');

const QUICK_QUESTIONS = [
    '分析一下双色球最近的走势',
    '近50期红球热号有哪些？',
    '什么是遗漏值，怎么理解？',
    '帮我机选一注大乐透',
];

const MAX_HISTORY_TURNS = 10;

function buildSystemPrompt() {
    let prompt = '你是「乐彩助手」小程序内置的 AI 助手，面向中国双色球和大乐透用户，用简体中文回答。规则：\n';
    prompt += '1. 你可以解释玩法规则、冷热号、遗漏值、奇偶比、和值等统计概念，并基于给出的历史开奖数据做描述性分析；\n';
    prompt += '2. 必须始终说明：开奖是独立随机事件，历史数据不能预测未来结果，任何选号方式都不会提高中奖概率；\n';
    prompt += '3. 用户请你"预测"或"推荐必中号码"时，明确拒绝预测，可以解释统计现象或给出随机选号建议；\n';
    prompt += '4. 提醒用户理性购彩，量力而行，未满18周岁禁止购彩；\n';
    prompt += '5. 回答简洁，控制在200字以内。\n\n';
    prompt += '以下是可参考的历史开奖数据（更新于 ' + DATA_UPDATED_AT + '，各100期）：\n';

    ['ssq', 'dlt'].forEach((key) => {
        const game = getGame(key);
        prompt += '\n【' + game.name + '】最近5期：\n';
        recentDraws(game, 5).forEach((d) => {
            prompt += d.code + '期(' + d.date + ') 主区 ' + d.main.join(' ') + '，副区 ' + d.extra.join(' ') + '\n';
        });
        const freqMain = frequency(game, 0, 50).sort((a, b) => b.cnt - a.cnt);
        prompt += '近50期主区热号：' + freqMain.slice(0, 5).map(f => pad(f.num) + '(' + f.cnt + '次)').join('、') + '；';
        prompt += '冷号：' + freqMain.slice(-5).reverse().map(f => pad(f.num) + '(' + f.cnt + '次)').join('、') + '\n';
        const om = omissions(game, 0).sort((a, b) => b.miss - a.miss).slice(0, 3);
        prompt += '当前主区遗漏最大：' + om.map(o => pad(o.num) + '遗漏' + o.miss + '期').join('、') + '\n';
    });
    return prompt;
}

function errorText(error) {
    const code = (error && error.error && error.error.code) || '';
    if (code.indexOf('quota_') === 0) {
        return '调用次数已达上限，请稍后再试。';
    }
    if (code.indexOf('auth_') === 0) {
        return '服务鉴权未通过，请稍后重试或联系开发者。';
    }
    if (code.indexOf('request_') === 0) {
        return '请求参数异常，请换个问法试试。';
    }
    if (code.indexOf('content') !== -1) {
        return '回复内容被安全策略拦截，请换个问法。';
    }
    if (code.indexOf('rate_') === 0 || code.indexOf('429') !== -1) {
        return '请求过于频繁，请稍等几秒再试。';
    }
    if (code) {
        return '网络或服务暂时不可用（' + code + '），请点击"重新生成"再试。';
    }
    return '网络或服务暂时不可用，请点击"重新生成"再试。';
}

let msgSeq = 0;

Page({
    data: {
        messages: [],
        input: '',
        generating: false,
        modelReady: false,
        errorMsg: '',
        quickQuestions: QUICK_QUESTIONS,
        modelNames: [],
        modelIndex: 0,
        currentModelName: '',
        scrollInto: '',
    },

    conversationId: '',
    controller: null,
    aborted: false,
    systemPrompt: '',
    models: [],

    onLoad() {
        this.systemPrompt = buildSystemPrompt();
        this.conversationId = 'conv-' + Date.now() + '-' + Math.floor(Math.random() * 100000);
        this.loadModels();
    },

    onShow() {
        applyTab(this);
    },

    onUnload() {
        if (this.controller) {
            this.controller.abort();
            this.controller = null;
        }
    },

    loadModels() {
        cloud.llm.models.list().then((models) => {
            const usable = models.filter(m => m.disabled !== true);
            if (usable.length === 0) {
                this.setData({ errorMsg: '暂无可用的 AI 模型' });
                return;
            }
            this.models = usable;
            const first = usable[0];
            this.setData({
                modelReady: true,
                modelNames: usable.map(m => m.name || m.id),
                modelIndex: 0,
                currentModelName: first.name || first.id,
            });
        }).catch(() => {
            this.setData({ errorMsg: 'AI 模型列表加载失败，请重新进入本页' });
        });
    },

    onModelChange(event) {
        const index = Number(event.detail.value);
        const model = this.models[index];
        if (model) {
            this.setData({ modelIndex: index, currentModelName: model.name || model.id });
        }
    },

    onInput(event) {
        this.setData({ input: event.detail.value });
    },

    useQuick(event) {
        const q = event.currentTarget.dataset.q;
        this.setData({ input: q }, () => this.send());
    },

    send() {
        const text = (this.data.input || '').trim();
        if (!text || this.data.generating || !this.data.modelReady) {
            return;
        }
        this.setData({ input: '', errorMsg: '' });
        this.appendMessage('user', text);
        this.appendMessage('ai', '', true);
        this.requestCompletion();
    },

    regenerate() {
        const msgs = this.data.messages;
        let lastUser = '';
        for (let i = msgs.length - 1; i >= 0; i -= 1) {
            if (msgs[i].role === 'user') {
                lastUser = msgs[i].text;
                break;
            }
        }
        if (!lastUser || this.data.generating) {
            return;
        }
        const kept = msgs.filter(m => !(m.role === 'ai' && !m.text));
        this.setData({ messages: kept, errorMsg: '' });
        this.appendMessage('ai', '', true);
        this.requestCompletion();
    },

    appendMessage(role, text, loading) {
        msgSeq += 1;
        const id = 'm' + msgSeq;
        const messages = this.data.messages.concat([{ id: id, role: role, text: text, loading: !!loading }]);
        this.setData({ messages: messages, scrollInto: 'msg-' + id });
        return id;
    },

    updateMessage(id, patch) {
        const messages = this.data.messages.map((m) => {
            if (m.id !== id) {
                return m;
            }
            return Object.assign({}, m, patch);
        });
        this.setData({ messages: messages, scrollInto: 'msg-' + id });
    },

    // 组装模型上下文：system 由 create() 单独传，这里取最近若干轮已完成消息（含最新一条用户提问）
    buildContext() {
        return this.data.messages
            .filter(m => !m.loading && m.text)
            .slice(-MAX_HISTORY_TURNS)
            .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));
    },

    requestCompletion() {
        const model = this.models[this.data.modelIndex];
        const context = this.buildContext();
        const lastUser = context.length > 0 ? context[context.length - 1] : null;
        if (!model || !lastUser || lastUser.role !== 'user') {
            this.setData({ generating: false, errorMsg: '会话状态异常，请重新输入' });
            return;
        }
        const aiMsgId = this.data.messages[this.data.messages.length - 1].id;
        const messages = [{ role: 'system', content: this.systemPrompt }]
            .concat(context.slice(0, -1))
            .concat([{ role: 'user', content: lastUser.content }]);

        this.aborted = false;
        this.setData({ generating: true });
        const streamOptions = {
            model: model.id,
            messages: messages,
            stream: true,
            conversationId: this.conversationId,
        };
        let abortController = null;
        let fallbackTask = null;
        if (typeof AbortController !== 'undefined') {
            abortController = new AbortController();
            streamOptions.signal = abortController.signal;
        }
        // 停止生成需要同时覆盖流式（AbortController）与降级（RequestTask）两条通道
        this.controller = null;
        this.cancelActive = () => {
            this.aborted = true;
            if (abortController) {
                abortController.abort();
            }
            if (fallbackTask) {
                fallbackTask.abort();
            }
        };

        let acc = '';
        let lastFlush = 0;

        const finish = (err) => {
            this.cancelActive = null;
            this.controller = null;
            this.setData({ generating: false });
            if (err && !this.aborted) {
                this.updateMessage(aiMsgId, { text: '', loading: false });
                this.setData({ errorMsg: errorText(err) });
            } else {
                // 正常结束或用户主动停止：保留已生成的文本
                this.updateMessage(aiMsgId, { text: acc, loading: false });
                if (this.aborted && !acc) {
                    this.updateMessage(aiMsgId, { text: '（已停止生成）' });
                }
                this.aborted = false;
            }
        };

        // 降级通道：普通请求一次性拿完整 SSE 响应并解析（不依赖分块传输）
        const useFallback = async (streamError) => {
            try {
                const text = await chatCompletionFallback({
                    model: model.id,
                    messages: messages,
                    onTask: (t) => { fallbackTask = t; },
                });
                if (this.aborted) {
                    finish(null);
                    return;
                }
                acc = text;
                this.updateMessage(aiMsgId, { text: acc, loading: false });
                finish(null);
            } catch (e2) {
                if (this.aborted || (e2 && e2.name === 'AbortError')) {
                    finish(null);
                    return;
                }
                // 降级也失败：优先展示降级错误（更贴近真实失败原因，如具体 HTTP 错误码），否则展示流式错误
                finish(e2 && e2.error ? e2 : streamError);
            }
        };

        const consume = async () => {
            try {
                // SDK 流式接口返回异步迭代器（不是 Promise），需用 for await 消费；
                // 兼容个别实现返回 Promise 的情况：先 await 再迭代
                let stream = cloud.llm.chat.completions.create(streamOptions);
                if (stream && typeof stream.then === 'function') {
                    stream = await stream;
                }
                for await (const chunk of stream) {
                    const choice = chunk.choices && chunk.choices[0];
                    const delta = choice && choice.delta;
                    if (delta && delta.content) {
                        acc += delta.content;
                        const now = Date.now();
                        if (now - lastFlush > 120) {
                            lastFlush = now;
                            this.updateMessage(aiMsgId, { text: acc });
                        }
                    }
                    if (choice && choice.finish_reason === 'content_filter') {
                        finish({ error: { code: 'content_filter' } });
                        return;
                    }
                }
                finish(null);
            } catch (e) {
                if (this.aborted || (e && e.name === 'AbortError')) {
                    finish(null);
                    return;
                }
                const streamError = e && e.error ? e : { error: { code: 'gateway_stream_interrupted' } };
                await useFallback(streamError);
            }
        };
        consume();
    },

    stopGenerate() {
        if (this.cancelActive) {
            this.cancelActive();
        }
    },
});
