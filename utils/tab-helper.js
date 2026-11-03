// tabBar 选中态同步（供 5 个 tab 页在 onShow 中调用）
// 注意：这里刻意不做页面级动效。page.animate 作用在整页根节点上，
// 每次 onShow 叠加动画任务，在预览运行时会导致灰白蒙层甚至页面卡死
// （两次事故均由它引起）。切 tab 的动效只在 custom-tab-bar 内用纯 CSS 实现。
const TAB_INDEX = {
    'pages/index/index': 0,
    'pages/pick/pick': 1,
    'pages/assistant/assistant': 2,
    'pages/stats/stats': 3,
    'pages/profile/profile': 4,
};

function applyTab(page) {
    const index = TAB_INDEX[page.route];
    if (index === undefined) {
        return;
    }
    // 同步自定义 tabBar 选中态
    if (typeof page.getTabBar === 'function' && page.getTabBar()) {
        page.getTabBar().setData({ selected: index });
    }
}

module.exports = { applyTab, TAB_INDEX };
