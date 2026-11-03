const { getGame, frequency, omissions, recentDraws, pad, NOTICE } = require('../../utils/lottery');
const { applyTab } = require('../../utils/tab-helper');

Page({
    data: {
        gameKey: 'ssq',
        gameName: '双色球',
        mainLabel: '红球',
        extraLabel: '蓝球',
        windowOptions: [
            { value: 30, label: '近30期' },
            { value: 50, label: '近50期' },
            { value: 100, label: '近100期' },
        ],
        windowSize: 50,
        hotMain: [],
        coldMain: [],
        extraFreq: [],
        omissionTop: [],
        recent: [],
        notice: NOTICE,
    },

    onLoad() {
        this.build('ssq', 50);
    },

    onShow() {
        applyTab(this);
    },

    switchGame(event) {
        this.build(event.currentTarget.dataset.game, this.data.windowSize);
    },

    switchWindow(event) {
        this.build(this.data.gameKey, Number(event.currentTarget.dataset.value));
    },

    build(key, windowSize) {
        const game = getGame(key);
        const freqMain = frequency(game, 0, windowSize);
        const sortedDesc = freqMain.slice().sort((a, b) => b.cnt - a.cnt);
        const maxCnt = sortedDesc[0] ? sortedDesc[0].cnt : 1;
        const maxMiss = Math.max.apply(null, omissions(game, 0).map(o => o.miss).concat([1]));

        const hotMain = sortedDesc.slice(0, 10).map(item => ({
            num: pad(item.num),
            cnt: item.cnt,
            pct: Math.max(8, Math.round((item.cnt / maxCnt) * 100)),
        }));
        const coldMain = sortedDesc.slice().reverse().slice(0, 10).map(item => ({
            num: pad(item.num),
            cnt: item.cnt,
            pct: Math.max(8, Math.round((item.cnt / maxCnt) * 100)),
        }));
        const extraFreq = frequency(game, 1, windowSize).map(item => ({
            num: pad(item.num),
            cnt: item.cnt,
        }));
        const omissionTop = omissions(game, 0).slice()
            .sort((a, b) => b.miss - a.miss)
            .slice(0, 10)
            .map(item => ({
                num: pad(item.num),
                miss: item.miss,
                pct: Math.max(8, Math.round((item.miss / maxMiss) * 100)),
            }));
        const recent = recentDraws(game, 10).map(item => ({
            code: item.code,
            sum: item.sum,
            odd: item.odd,
            even: item.even,
        }));

        this.setData({
            gameKey: game.key,
            gameName: game.name,
            mainLabel: game.groups[0].label,
            extraLabel: game.groups[1].label,
            windowSize: windowSize,
            hotMain: hotMain,
            coldMain: coldMain,
            extraFreq: extraFreq,
            omissionTop: omissionTop,
            recent: recent,
        });
    },
});
