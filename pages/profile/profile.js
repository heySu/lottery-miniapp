const pickStore = require('../../utils/pick-store');
const { DATA_UPDATED_AT } = require('../../utils/lottery');
const { applyTab } = require('../../utils/tab-helper');

Page({
    data: {
        recordCount: 0,
        dataUpdatedAt: DATA_UPDATED_AT,
    },

    onShow() {
        applyTab(this);
        this.refresh();
    },

    refresh() {
        pickStore.list().then((res) => {
            const count = res.error ? 0 : res.data.length;
            this.setData({ recordCount: count });
        });
    },

    openRecords() {
        wx.navigateTo({ url: '/pages/records/records' });
    },
});
