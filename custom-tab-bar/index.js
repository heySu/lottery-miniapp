// 自定义 tabBar：滑动胶囊高亮 + 选中弹跳动效。
// 页面在 onShow 中通过 getTabBar().setData({selected}) 同步选中态。
Component({
    data: {
        selected: 0,
        list: [
            { pagePath: '/pages/index/index', text: '开奖' },
            { pagePath: '/pages/pick/pick', text: '选号' },
            { pagePath: '/pages/assistant/assistant', text: 'AI', icon: true },
            { pagePath: '/pages/stats/stats', text: '走势' },
            { pagePath: '/pages/profile/profile', text: '我' },
        ],
    },

    methods: {
        switchTab(event) {
            const index = Number(event.currentTarget.dataset.index);
            const item = this.data.list[index];
            if (!item || index === this.data.selected) {
                return;
            }
            wx.switchTab({ url: item.pagePath });
        },
    },
});
