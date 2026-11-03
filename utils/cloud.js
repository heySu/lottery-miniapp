// 云服务客户端：云服务激活时返回的 publicConfig 初始化（endpoint + publishableKey 必传）
const { createMiniProgramWorkBuddyCloud } = require('@tencent-ai/workbuddy-cloud-sdk/miniprogram');
const { createDiagnosticWx } = require('./workbuddy-cloud-diagnostics');
const { createChatCompletionFallback } = require('./llm-fallback');

const publicConfig = {
    endpoint: 'https://mp-api.app.workbuddy.host',
    publishableKey: 'wbpk_71f5ZM48M6trnPn8MjHABV_Pnf4u7y61bo8ghkDES9VDt2jU3a0GVcd',
};

const cloud = createMiniProgramWorkBuddyCloud({
    endpoint: publicConfig.endpoint,
    publishableKey: publicConfig.publishableKey,
    wx: createDiagnosticWx(wx),
});

// 流式失败时的降级请求（普通 wx.request + SSE 解析，不依赖分块传输）
const chatCompletionFallback = createChatCompletionFallback(publicConfig);

module.exports = { cloud, publicConfig, chatCompletionFallback };
