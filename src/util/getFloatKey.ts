const floatKeys = [{
    range: [0, 0.07],
    name: 'SFUI_InvTooltip_Wear_Amount_0'
},{
    range: [0.07, 0.15],
    name: 'SFUI_InvTooltip_Wear_Amount_1'
},{
    range: [0.15, 0.38],
    name: 'SFUI_InvTooltip_Wear_Amount_2'
},{
    range: [0.38, 0.45],
    name: 'SFUI_InvTooltip_Wear_Amount_3'
},{
    range: [0.45, 1.00],
    name: 'SFUI_InvTooltip_Wear_Amount_4'
}];

export default function getFloatKey(float: number | null) {
    if(float == null || float <= 0 || float > 1) return null;
    return floatKeys.find((f) => float > f.range[0] && float <= f.range[1])['name'];
}