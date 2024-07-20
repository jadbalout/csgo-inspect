import SteamUser from 'steam-user';
import SteamTotp from 'steam-totp';
import GlobalOffensive from 'globaloffensive';
import { EventEmitter } from 'events';
export interface SteamBotConfig {
    accountName: string;
    password: string;
    sharedSecret: string;
}
export interface BotRequestConfig {
    requestTTL?: number;
    requestDelay?: number;
    httpProxy?: string;
}
export const DEFAULT_BOT_REQUEST_CONFIG: BotRequestConfig = {
    requestTTL: 10000,
    requestDelay: 2000
};
export enum BotState {
    LoggedOut,
    Ready,
    Busy
};

export interface CSGOItem {
    accountid: null;
    itemid: string;
    defindex: number;
    paintindex: number;
    rarity: number;
    quality: number;
    paintwear: number | string; //could store as string to avoid float precision issues with database
    paintseed: number;
    killeaterscoretype: any;
    killeatervalue: any;
    customname: any;
    inventory: number;
    origin: number;
    questid: any;
    dropreason: any;
    musicindex: any;
    entindex: any;
    stickers: any[];
}

export class Bot extends EventEmitter {
    private steamBotConfig: SteamBotConfig;
    private requestConfig: BotRequestConfig;
    private reloginInterval: NodeJS.Timeout;
    state = BotState.LoggedOut;
    steamClient: SteamUser;
    csgoClient: GlobalOffensive;

    constructor(steamBotConfig: SteamBotConfig, requestConfig: BotRequestConfig = {}) {
        super();
        this.steamBotConfig = steamBotConfig;
        for (let key in DEFAULT_BOT_REQUEST_CONFIG) {
            if (!requestConfig[key]) {
                requestConfig[key] = DEFAULT_BOT_REQUEST_CONFIG[key];
            }
        }
        this.requestConfig = requestConfig;

        //Setup steam client
        this.steamClient = new SteamUser({
            enablePicsCache: true,
            httpProxy: requestConfig.httpProxy,
            webCompatibilityMode: true
            //for future, can add proxy here.
        });
        this.steamClient.on('error', this.onLoginError.bind(this));
        this.steamClient.on('disconnected', this.onDisconnected.bind(this));
        this.steamClient.on('loggedOn', this.onLoggedIn.bind(this));

        //Setup csgo client
        this.csgoClient = new GlobalOffensive(this.steamClient);
        this.csgoClient.on('connectedToGC', this.onConnectedToGC.bind(this));
        this.csgoClient.on('disconnectedFromGC', this.onDisconnectedFromGC.bind(this));
        this.csgoClient.on('connectionStatus', this.onConnectionStatus.bind(this));
        this.csgoClient.on('inspectItemInfo', this.onInspectItemInfo.bind(this));
        this.csgoClient.on('debug', this.onDebug.bind(this));

        this.steamClient.on("steamGuard", (domain, callback, lastCodeWrong) => {
            if(lastCodeWrong) {
                console.log("Last code wrong, try again!");
            }	
            setTimeout(() => callback(SteamTotp.generateAuthCode(this.steamBotConfig.sharedSecret)), 15000);	
        });
    }

    login() {
        console.log(`[${this.steamBotConfig.accountName}] Logging in`);
        this.steamClient.logOn({
            logonID: Math.floor(Math.random() * 10_000),
            accountName: this.steamBotConfig.accountName,
            password: this.steamBotConfig.password,
            rememberPassword: true,
            twoFactorCode: SteamTotp.generateAuthCode(this.steamBotConfig.sharedSecret)
        });

        //Setup random relogins every 30-40 minutes
        if(this.reloginInterval) {
            clearInterval(this.reloginInterval);
        }
        this.reloginInterval = setInterval(() => {
            if (this.csgoClient.haveGCSession) {
                this.steamClient.relog();
            }
        }, 30 * 60 * 1000 + Math.random() * 10 * 60 * 1000);
    }
    onLoginError(err) {
        console.log(`[${this.steamBotConfig.accountName}] Login error ${err}`);
        if(err.message == "Proxy connection timed out") {
            console.log(`[${this.steamBotConfig.accountName}] Retrying login in 10 seconds`);
            setTimeout(() => {
                this.login();
            }, 10000);
        }
    }
    onDisconnected(eresult, msg) {
        console.log(`[${this.steamBotConfig.accountName}] Logged off, reconnecting! (${eresult}, ${msg})`);
    }

    onLoggedIn() { //Can also be called on relogin.
        console.log(`[${this.steamBotConfig.accountName}] Logged in`);
        this.steamClient.gamesPlayed([], true);
        if (this.state !== BotState.LoggedOut) {
            //This is a relogin
            return this.steamClient.gamesPlayed([730], true);
        }
        this.steamClient.once('ownershipCached', () => {
            if (this.steamClient.ownsApp(730)) {
                return this.steamClient.gamesPlayed([730], true);
            }
            this.steamClient.requestFreeLicense([730], (err, grantedPackages, grantedAppIDs) => {
                if (err) {
                    console.log(`[${this.steamBotConfig.accountName}] Failed to obtain free CS:GO license. Logging out.`);
                    this.steamClient.logOff();
                } else {
                    this.steamClient.gamesPlayed([730], true);
                }
            });
        });
    }
    onConnectedToGC() {
        console.log(`[${this.steamBotConfig.accountName}] Connected to GC`);
        setTimeout(() => {
            this.state = BotState.Ready;
            this.emit('ready');
        }, 5000); //Wait 5 seconds before setting state to ready
    }
    onDisconnectedFromGC() {
        console.log(`[${this.steamBotConfig.accountName}] Disconnected from GC`);
        this.state = BotState.LoggedOut; //will reconnect automatically
    }
    onConnectionStatus(status: any) {
        console.log(`[${this.steamBotConfig.accountName}] Connection status ${status}`);
    }
    onDebug(msg: any) {
        console.log(`[${this.steamBotConfig.accountName}] Debug ${msg}`);
    }
    onInspectItemInfo(itemData: any) {
        console.log(`[${this.steamBotConfig.accountName}] Inspect item info`, itemData);
    }

    inspectItem(inspectLink: string): Promise<CSGOItem> {
        console.log(`[${this.steamBotConfig.accountName}] Inspecting item ${inspectLink}`);
        return new Promise((resolve, reject) => {
            if (this.state !== BotState.Ready) {
                return reject(`Bot is not ready`);
            }
            this.state = BotState.Busy;
            let timeout;
            let listener = (item) => {
                clearTimeout(timeout);
                setTimeout(() => { 
                    this.state = BotState.Ready 
                }, this.requestConfig.requestDelay);
                resolve(item);
            };
            timeout = setTimeout(() => {
                this.csgoClient.removeListener('inspectItemInfo', listener);
                setTimeout(() => { 
                    this.state = BotState.Ready 
                }, this.requestConfig.requestDelay);
                reject(`Request timed out.`);
            }, this.requestConfig.requestTTL);
    
            this.csgoClient.once('inspectItemInfo', listener);
            this.csgoClient.inspectItem(inspectLink);
        });
    }

}