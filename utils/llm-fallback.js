// LLM 对话降级通道：SDK 流式依赖 wx.request 的 enableChunked/onChunkReceived（分块传输），
// 部分运行时不支持会导致流式失败。此模块改用普通请求一次性拿到完整 SSE 响应并自行解析。
const LLM_CHAT_PATH = '/.cloud/llm/chat/completions';

function parseSseContent(raw) {
    let text = '';
    String(raw || '').split(/\r?\n/).forEach((line) => {
        if (line.indexOf('data:') !== 0) {
            return;
        }
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') {
            return;
        }
        try {
            const chunk = JSON.parse(payload);
            const choice = chunk.choices && chunk.choices[0];
            const delta = choice && choice.delta;
            if (delta && delta.content) {
                text += delta.content;
            }
        } catch (e) {
            // 忽略无法解析的行（如非 data 前缀内容、截断行）
        }
    });
    return text;
}

function createChatCompletionFallback(config) {
    return function chatCompletionFallback(options) {
        return new Promise((resolve, reject) => {
            const task = wx.request({
                url: config.endpoint + LLM_CHAT_PATH,
                method: 'POST',
                dataType: 'text',
                header: {
                    'Content-Type': 'application/json',
                    Accept: 'text/event-stream',
                    'x-wb-webapp-access-key': config.publishableKey,
                },
                data: {
                    model: options.model,
                    messages: options.messages,
                    stream: true,
                },
                success(res) {
                    if (res.statusCode < 200 || res.statusCode >= 300) {
                        let code = 'gateway_http_' + res.statusCode;
                        let message = 'HTTP ' + res.statusCode;
                        const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data || {});
                        try {
                            const parsed = JSON.parse(body);
                            if (parsed && parsed.error && parsed.error.code) {
                                code = parsed.error.code;
                                if (parsed.error.message) {
                                    message = parsed.error.message;
                                }
                            }
                        } catch (e) {
                            // 保持默认 code/message
                        }
                        reject({ error: { code: code, message: message } });
                        return;
                    }
                    const text = parseSseContent(res.data);
                    if (!text) {
                        reject({ error: { code: 'gateway_empty_response' } });
                        return;
                    }
                    resolve(text);
                },
                fail(res) {
                    if (res.errMsg && res.errMsg.indexOf('abort') !== -1) {
                        const err = new Error('The operation was aborted.');
                        err.name = 'AbortError';
                        reject(err);
                        return;
                    }
                    reject({ error: { code: 'gateway_network_error', message: res.errMsg || 'request failed' } });
                },
            });
            if (options.onTask && task) {
                options.onTask(task);
            }
        });
    };
}

module.exports = { parseSseContent, createChatCompletionFallback };
