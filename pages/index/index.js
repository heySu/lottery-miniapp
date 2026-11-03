const { getGame, latestDraw, recentDraws, NOTICE, DATA_UPDATED_AT } = require('../../utils/lottery');
const { applyTab } = require('../../utils/tab-helper');

Page({
    data: {
        gameKey: 'ssq',
        gameName: '双色球',
        drawInfo: '',
        latest: null,
        history: [],
        historyCount: 0,
        notice: NOTICE,
        dataUpdatedAt: DATA_UPDATED_AT,
    },

    onLoad() {
        this.applyGame('ssq');
    },

    onShow() {
        applyTab(this);
    },

    applyGame(key) {
        const game = getGame(key);
        this.setData({
            gameKey: game.key,
            gameName: game.name,
            drawInfo: game.drawInfo,
            latest: latestDraw(game),
            history: recentDraws(game, 8),
            historyCount: game.history.length,
        });
    },

    switchGame(event) {
        this.applyGame(event.currentTarget.dataset.game);
    },

    goPick() {
        wx.switchTab({ url: '/pages/pick/pick' });
    },

    goStats() {
        wx.switchTab({ url: '/pages/stats/stats' });
    },
});
