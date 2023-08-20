import { SteamBotConfig } from "../bot";
import { BaseAdapter } from "./base-adapter";
import fs from "fs";
import path from "path";
export class FileAdapter extends BaseAdapter {
    //File Adapter. This can only be used for storing bots. Items are not supported.
    constructor() {
        super();
    }
    async getBots(): Promise<SteamBotConfig[]> {
        //Get bots from bots.json from the root directory of where the program is running.
        if (fs.existsSync(path.join(process.cwd(), "bots.json"))) {
            return JSON.parse(fs.readFileSync(path.join(process.cwd(), "bots.json"), "utf8"));
        } else {
            fs.writeFileSync(path.join(process.cwd(), "bots.json"), JSON.stringify([]));
            return [];
        }
    }
    async getItemByAssetId(assetId: string): Promise<any> {
        //Not implemented.
        return null;
    }
    async getItemsByAssetIds(assetIds: string[]): Promise<any[]> {
        //Not implemented.
        return [];
    }
    async createOrUpdateItem(item: any): Promise<any> {
        //Not implemented.
        return null;
    }

    async createOrUpdateItems(items: any[]): Promise<any> {
        //Not implemented.
        return null;
    }

}