import fs from 'fs';
import https from 'https';
import * as vdf from 'simple-vdf';
import getFloatKey from './util/getFloatKey';
import { CSGOItem } from './bot';
import getPhaseByPaintIndex from './util/getPhaseByPaintIndex';

export interface GameItemSticker {
    codename: string;
    material: string;
    name: string;
}
//Adapted key naming convention from csgo's inspect response
export type ExpandedCSGOItem = CSGOItem & {
    stickers: GameItemSticker[];
    imageurl: string;
    floatmin: number;
    floatmax: number;
    weapontype: string;
    itemname: string;
    rarityname: string;
    qualityname: string;
    originname: string;
    wearname: string;
    fullitemname: string;
    phasename: string;
}

export class GameData {
    items_game_url: string;
    items_game_cdn_url: string;
    csgo_english_url: string;
    schema_url: string;
    itemsGame: Record<string, any>;
    csgoGameUIEnglish: Record<string, any>;
    schema: Record<string, any>;
    itemsGameCDN: Record<string, any>;
    ready = false;
    constructor() {
        //Heavily inspired by csfloat
        this.items_game_url = 'https://raw.githubusercontent.com/Citrinate/CS2-ItemFileTracking/main/items_game.txt';
        this.items_game_cdn_url = 'https://raw.githubusercontent.com/SteamDatabase/GameTracking-CSGO/master/csgo/scripts/items/items_game_cdn.txt';
        this.csgo_english_url = 'https://raw.githubusercontent.com/SteamDatabase/GameTracking-CSGO/master/game/csgo/resource/csgo_english.txt';
        this.schema_url = 'https://raw.githubusercontent.com/SteamDatabase/SteamTracking/b5cba7a22ab899d6d423380cff21cec707b7c947/ItemSchema/CounterStrikeGlobalOffensive.json';
        
        if (!fs.existsSync('./game_files')) {
            fs.mkdirSync('./game_files');
        } else {
            this.loadFiles();
        }
        this.updateGameFiles(); //update files
        setInterval(this.updateGameFiles.bind(this), 60 * 60 * 1000);
    }

    async updateGameFiles() {
        const files = {
            'items_game.txt': this.items_game_url,
            'items_game_cdn.txt': this.items_game_cdn_url,
            'csgo_english.txt': this.csgo_english_url,
            'schema.json': this.schema_url
        };
        for(const file in files) {
            try {
                await this.downloadFile(files[file], `./game_files/${file}`);
            } catch (error) {
                console.log(`Failed to donwload ${file} from ${files[file]}::`, error);
            }
        }
        this.loadFiles();
    }

    loadFiles() {
        if(fs.existsSync('./game_files/items_game.txt')) {
            this.itemsGame = vdf.parse(fs.readFileSync('./game_files/items_game.txt', 'utf8'))['items_game'];
        }
        if (fs.existsSync('./game_files/items_game_cdn.txt')) {
            let data = fs.readFileSync('./game_files/items_game_cdn.txt', 'utf8');
            let tempCDN = {};
            const lines = data.split('\n');
            for (let line of lines) {
                let kv = line.split('=');
                if (kv.length > 1) {
                    tempCDN[kv[0]] = kv[1];
                }
            }
            this.itemsGameCDN = tempCDN;
        }
        if (fs.existsSync('./game_files/csgo_english.txt')) {
            this.csgoGameUIEnglish = vdf.parse(fs.readFileSync('./game_files/csgo_english.txt', 'utf8'))['lang']['Tokens'];
        }
        if (fs.existsSync('./game_files/schema.json')) {
            let data = fs.readFileSync('./game_files/schema.json', 'utf8');
            this.schema = JSON.parse(data)['result'];
        }
        this.ready = true;
    }
    

    async downloadFile(url: string, fileName: string): Promise<void> {
        const fileStream = fs.createWriteStream(fileName);

        return new Promise<void>((resolve, reject) => {
            https.get(url, response => {
                response.pipe(fileStream);

                fileStream.on('finish', () => {
                    fileStream.close();
                    resolve();
                });

                response.on('error', error => {
                    fileStream.close();
                    reject(error);
                });
            }).on('error', error => {
                reject(error);
            });
        });
    }

    
    addAdditionalItemProperties(iteminfo: CSGOItem): ExpandedCSGOItem {
        if (iteminfo == null || !this.itemsGame || !this.itemsGameCDN || !this.csgoGameUIEnglish) return null;

        const expandedItem = iteminfo as CSGOItem & ExpandedCSGOItem;
        //if the paintwear is string, convert it to float
        if (typeof expandedItem.paintwear === 'string') {
            expandedItem.paintwear = parseFloat(expandedItem.paintwear);
        }
        // Get sticker codename/name
        const stickerKits = this.itemsGame.sticker_kits;
        for (const sticker of expandedItem.stickers || []) {
            const kit = stickerKits[sticker.sticker_id];

            if (!kit) continue;

            sticker.codename = kit.name;
            sticker.material = kit.sticker_material;

            let name = this.csgoGameUIEnglish[kit.item_name.replace('#', '')];

            if (sticker.tint_id) {
                name += ` (${this.csgoGameUIEnglish[`Attrib_SprayTintValue_${sticker.tint_id}`]})`;
            }

            if (name) sticker.name = name;
        }

        // Get the skin name
        let skin_name = '';

        if (expandedItem.paintindex in this.itemsGame['paint_kits']) {
            skin_name = '_' + this.itemsGame['paint_kits'][expandedItem.paintindex]['name'];

            if (skin_name == '_default') {
                skin_name = '';
            }
        }

        // Get the weapon name
        let weapon_name;

        if (expandedItem.defindex in this.itemsGame['items']) {
            weapon_name = this.itemsGame['items'][expandedItem.defindex]['name'];
        }

        // Get the image url
        let image_name = weapon_name + skin_name;

        if (image_name in this.itemsGameCDN) {
            expandedItem.imageurl = this.itemsGameCDN[image_name];
        }

        // Get the paint data and code name
        let code_name;
        let paint_data;

        if (expandedItem.paintindex in this.itemsGame['paint_kits']) {
            code_name = this.itemsGame['paint_kits'][expandedItem.paintindex]['description_tag'].replace('#', '');
            paint_data = this.itemsGame['paint_kits'][expandedItem.paintindex];
        }

        expandedItem.floatmin = (paint_data && 'wear_remap_min' in paint_data) ? parseFloat(paint_data['wear_remap_min']) : 0.06;
        expandedItem.floatmax = (paint_data && 'wear_remap_max' in paint_data) ? parseFloat(paint_data['wear_remap_max']) : 0.8;

        let weapon_data = null;

        if (expandedItem.defindex in this.itemsGame['items']) {
            weapon_data = this.itemsGame['items'][expandedItem.defindex];
        }

        // Get the weapon_hud
        let weapon_hud;

        if (weapon_data !== null && 'item_name' in weapon_data) {
            weapon_hud = weapon_data['item_name'].replace('#', '');
        }
        else {
            // need to find the weapon hud from the prefab
            if (expandedItem.defindex in this.itemsGame['items']) {
                let prefab_val = this.itemsGame['items'][expandedItem.defindex]['prefab'];
                weapon_hud = this.itemsGame['prefabs'][prefab_val]['item_name'].replace('#', '');
            }
        }

        // Get the skin name if we can
        if (weapon_hud in this.csgoGameUIEnglish && code_name in this.csgoGameUIEnglish) {
            expandedItem.weapontype = this.csgoGameUIEnglish[weapon_hud];
            expandedItem.itemname = this.csgoGameUIEnglish[code_name];
        }

        // Get the rarity name (Mil-Spec Grade, Covert etc...)
        const rarityKey = Object.keys(this.itemsGame['rarities']).find((key) => {
            return parseInt(this.itemsGame['rarities'][key]['value']) === expandedItem.rarity;
        });

        if (rarityKey) {
            const rarity = this.itemsGame['rarities'][rarityKey];

            // Assumes weapons always have a float above 0 and that other items don't
            // TODO: Improve weapon check if this isn't robust
            expandedItem.rarityname = this.csgoGameUIEnglish[rarity[expandedItem.paintwear > 0 ? 'loc_key_weapon' : 'loc_key']];
        }

        // Get the quality name (Souvenir, Stattrak, etc...)
        const qualityKey = Object.keys(this.itemsGame['qualities']).find((key) => {
            return parseInt(this.itemsGame['qualities'][key]['value']) === expandedItem.quality;
        });

        expandedItem.phasename = getPhaseByPaintIndex(expandedItem.paintindex);
        expandedItem.qualityname = this.csgoGameUIEnglish[qualityKey];

        // Get the origin name
        const origin = this.schema['originNames'].find((o) => o.origin === expandedItem.origin);

        if (origin) {
            expandedItem.originname = origin['name'];
        }

        // Get the wear name
        const floatKey = getFloatKey(expandedItem.paintwear);
        expandedItem.wearname = floatKey ? this.csgoGameUIEnglish[floatKey] : undefined;

        expandedItem.fullitemname = this.getFullItemName(expandedItem);
        return expandedItem;
    }

    getFullItemName(expandedItem: Omit<ExpandedCSGOItem, 'fullitemname'>) {
        let name = '';

        // Default items have the "unique" quality
        if (expandedItem.quality !== 4) {
            name += `${expandedItem.qualityname} `;
        }

        // Patch for items that are stattrak and unusual (ex. Stattrak Karambit)
        if (expandedItem.killeatervalue !== null && expandedItem.quality !== 9) {
            name += `${this.csgoGameUIEnglish['strange']} `;
        }

        name += `${expandedItem.weapontype} `;

        if (expandedItem.weapontype === 'Sticker' || expandedItem.weapontype === 'Sealed Graffiti' || expandedItem.weapontype === 'Graffiti') {
            name += `| ${expandedItem.stickers[0].name}`;
        }

        // Vanilla items have an item_name of '-'
        if (expandedItem.itemname && expandedItem.itemname !== '-') {
            name += `| ${expandedItem.itemname} `;

            if(expandedItem.phasename) {
                name += `(${expandedItem.phasename})`;
            } else if (expandedItem.wearname) {
                name += `(${expandedItem.wearname})`;
            }
        }

        return name.trim();
    }

}