export default function generateInspectLink(steamOrMarketListingId: string, a: string, d: string, isMarketListing: boolean = false): string {
    let idSubString = isMarketListing ? `M${steamOrMarketListingId}` : `S${steamOrMarketListingId}`;
    return `steam://rungame/730/76561202255233023/+csgo_econ_action_preview ${idSubString}A${a}D${d}`;
};