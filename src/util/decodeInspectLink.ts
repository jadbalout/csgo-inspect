export default function decodeInspectLink(inspectLink: string) {
    const match = inspectLink.match(/[SM](\d+)A(\d+)D(\d+)$/);
    if(!match || match.length < 4) throw new Error("Invalid inspect link");
    return {
        steamId: match[1],
        assetId: match[2],
        d: match[3]
    };
}