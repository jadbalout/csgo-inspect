const phaseByPaintIndex = {
    415: 'Ruby',
    416: 'Sapphire',
    417: 'Black Pearl',
    418: 'Phase 1',
    419: 'Phase 2',
    420: 'Phase 3',
    421: 'Phase 4',
    568: 'Emerald',
    569: 'Phase 1',
    570: 'Phase 2',
    571: 'Phase 3',
    572: 'Phase 4',
    617: 'Black Pearl',
    618: 'Phase 2',
    619: 'Sapphire',
    852: 'Phase 1',
    853: 'Phase 2',
    854: 'Phase 3',
    855: 'Phase 4',
    1119: 'Emerald',
    1120: 'Phase 1',
    1121: 'Phase 2',
    1122: 'Phase 3',
    1123: 'Phase 4',
};
export default function getPhaseByPaintIndex(paintIndex) {
    return phaseByPaintIndex[paintIndex] ?? null;
}