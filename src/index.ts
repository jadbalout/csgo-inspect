import { BaseAdapter, FileAdapter } from "./adapter";
import { Bot } from "./bot";
import { ExpandedCSGOItem, GameData } from "./game-data";
import { Job, Queue } from "./queue";
import decodeInspectLink from "./util/decodeInspectLink";
interface CSGOInspectorConfig {
    requestTTL?: number;
    requestDelay?: number;
    httpProxies?: string[];
}
export class CSGOInspector {
    databaseAdapter: BaseAdapter;
    queue: Queue;
    gameData: GameData;
    proxyIndex = 0;
    config: CSGOInspectorConfig;
    constructor(config: CSGOInspectorConfig = {}) {
        this.databaseAdapter = new FileAdapter();
        this.queue = new Queue();
        this.gameData = new GameData();
        this.config = config;
    }

    useAdapter(adapter: BaseAdapter) {
        this.databaseAdapter = adapter;
    }

    async loadBots() {
        const bots = await this.databaseAdapter.getBots();
        for(const botConfig of bots) {
            let httpProxy = undefined;
            if(this.config.httpProxies && this.config.httpProxies.length > 0) {
                httpProxy = this.config.httpProxies[this.proxyIndex];
                this.proxyIndex++;
                if(this.proxyIndex >= this.config.httpProxies.length) {
                    this.proxyIndex = 0;
                }
            }
            const bot = new Bot(botConfig, {
                httpProxy,
                requestTTL: this.config.requestTTL,
                requestDelay: this.config.requestDelay
            });
            this.queue.addWorker(bot);
        }
    }

    async getItemByInspectLink(inspectLink: string): Promise<ExpandedCSGOItem> {
        const { assetId } = decodeInspectLink(inspectLink);
        const item = await this.databaseAdapter.getItemByAssetId(assetId);
        if(item) return this.gameData.addAdditionalItemProperties(item);
        //
        return new Promise((resolve, reject) => {
            this.queue.add(inspectLink, (err, job) => {
                if(err) reject(err);
                const item = job.data;
                if(item == null) return resolve(null);
                this.databaseAdapter.createOrUpdateItem(item);
                const expandedItem = this.gameData.addAdditionalItemProperties(item);
                resolve(expandedItem);
            });
        });
    }

    async getItemsByInspectLinks(inspectLinks: string[]): Promise<Record<string, ExpandedCSGOItem>> {
        inspectLinks = [...new Set(inspectLinks)];
        const inspectLinkByAssetIds = {};
        for(let inspectLink of inspectLinks) {
            const { assetId } = decodeInspectLink(inspectLink);
            inspectLinkByAssetIds[assetId] = inspectLink;
        }
        const items = await this.databaseAdapter.getItemsByAssetIds(Object.keys(inspectLinkByAssetIds));
        const itemsByInspectLink = {};
        for(let item of items) {
            let expandedItem = this.gameData.addAdditionalItemProperties(item);
            itemsByInspectLink[inspectLinkByAssetIds[item.itemid]] = expandedItem;
        }
        if(items.length === inspectLinks.length) return itemsByInspectLink;
        const remainingInspectLinks = inspectLinks.filter(inspectLink => !itemsByInspectLink[inspectLink]);
        return new Promise((resolve, reject) => {
            this.queue.addBatch(remainingInspectLinks, (jobs: Job[]) => {
                const items = jobs.filter(job => job.data !== null).map(job => job.data);
                this.databaseAdapter.createOrUpdateItems(items);
                for(let job of jobs) {
                    if(job.data == null) {
                        itemsByInspectLink[job.inspectLink] = null;
                    } else {
                        let expandedItem = this.gameData.addAdditionalItemProperties(job.data);
                        itemsByInspectLink[job.inspectLink] = expandedItem;
                    }
                }
                resolve(itemsByInspectLink);
            });
        });
    }
}