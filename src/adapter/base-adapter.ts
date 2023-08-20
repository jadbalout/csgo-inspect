import { Bot, SteamBotConfig } from "../bot";

export abstract class BaseAdapter {
    abstract getBots(): Promise<SteamBotConfig[]>;
    abstract getItemByAssetId(assetId: string): Promise<any | null>;
    abstract getItemsByAssetIds(assetIds: string[]): Promise<any[] | null>;
    abstract createOrUpdateItem(item: any): Promise<any>;
    abstract createOrUpdateItems(items: any[]): Promise<any>;
}