const pickStore = require('../../utils/pick-store');
const { pad } = require('../../utils/lottery');

function formatDate(timestamp) {
    const d = new Date(timestamp);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const hour = d.getHours() < 10 ? '0' + d.getHours() : '' + d.getHours();
    const minute = d.getMinutes() < 10 ? '0' + d.getMinutes() : '' + d.getMinutes();
    return d.getFullYear() + '-' + month + '-' + day + ' ' + hour + ':' + minute;
}

Page({
    data: {
        items: [],
        viewState: 'loading',
    },

    onShow() {
        this.load();
    },

    load() {
        pickStore.list().then((res) => {
            if (res.error) {
                this.setData({ viewState: 'empty', items: [] });
                return;
            }
            const items = res.data.map(item => ({
                id: item.id,
                gameName: item.gameName,
                modeName: item.modeName,
                main: item.main.map(pad),
                extra: item.extra.map(pad),
                isMulti: !!item.isMulti,
                betCount: item.betCount || 0,
                amount: item.amount || 0,
                dateText: formatDate(item.createdAt),
            }));
            this.setData({
                items: items,
                viewState: items.length > 0 ? 'ready' : 'empty',
            });
        });
    },

    removeItem(event) {
        const id = event.currentTarget.dataset.id;
        wx.showModal({
            title: '删除这条记录？',
            content: '删除后无法恢复',
            confirmColor: '#d9483b',
            success: (res) => {
                if (res.confirm) {
                    pickStore.remove(id).then(() => this.load());
                }
            },
        });
    },

    clearAll() {
        if (this.data.items.length === 0) {
            return;
        }
        wx.showModal({
            title: '清空全部记录？',
            content: '共 ' + this.data.items.length + ' 条，删除后无法恢复',
            confirmColor: '#d9483b',
            success: (res) => {
                if (res.confirm) {
                    pickStore.clearAll().then(() => this.load());
                }
            },
        });
    },
});
