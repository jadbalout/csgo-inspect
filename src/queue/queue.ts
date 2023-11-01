import { Bot, BotState, CSGOItem } from "../bot";
import { EventEmitter } from "events";
import { Job, JobCallback, JobState } from "./job";

export class Queue extends EventEmitter {
    
    workers: Bot[] = [];
    jobs: Job[] = [];
    isRunning: boolean = false;

    constructor() {
        super();
        setInterval(this.checkQueue.bind(this), 50);
    }

    checkQueue() {
        if(this.jobs.length > 0 && this.getReadyWorkersCount() > 0) {
            this.process();
        }
    }

    addWorker(bot: Bot) {
        if(bot.state !== BotState.LoggedOut) {
            this.workers.push(bot);
            this.process();
            return;
        }
        bot.once('ready', () => {
            this.workers.push(bot);
            this.process();
        });
        bot.login();
        
    }

    getWorker() {
        for(let i = 0; i < this.workers.length; i++) {
            if(this.workers[i].state == BotState.Ready) {
                return this.workers[i];
            }
        }
        return null;
    }

    getReadyWorkersCount() {
        let count = 0;
        for(let i = 0; i < this.workers.length; i++) {
            if(this.workers[i].state == BotState.Ready) {
                count++;
            }
        }
        return count;
    }

    _addJob(inspectLink: string, callback?: JobCallback) { //Private method, use add() instead.
        const job = new Job(inspectLink, callback);
        job.on('failed', () => {
            this.emit('job-failed', { job, err: job.err });
            this.process();
        });
        this.jobs.push(job);
    }

    add(inspectLink: string, callback?: JobCallback) {
        this._addJob(inspectLink, callback);
        this.process();
    }

    addBatch(inspectLinks: string[], callback?: (res: Job[]) => void) {
        const res = [];
        const jobCallback = (err, job) => {
            res.push(job);
            if(res.length === inspectLinks.length) {
                if(callback) callback(res);
            }
        };
        for(let i = 0; i < inspectLinks.length; i++) {
            this._addJob(inspectLinks[i], jobCallback);
        }
        this.process();
    }

    process() {
        if(this.isRunning) return;
        this.isRunning = true;
        //We want to run this at concurrency = to the number of workers
        for(let i = 0; i < this.workers.length; i++) {
            const worker = this.workers[i];
            if(worker.state !== BotState.Ready) continue;
            const job = this.jobs.shift();
            if(job) {
                if(job.state !== JobState.Created) continue;
                job.state = JobState.Pending;
                worker.inspectItem(job.inspectLink).then((item: CSGOItem) => {
                    job.data = item;
                    job.state = JobState.Completed;
                    if(job.callback) job.callback(null, job);
                    this.emit('job-completed', job);
                    this.process();
                }).catch((err: any) => {
                    if(job.state !== JobState.Failed) {
                        job.fail(err);
                        this.process();
                    }
                });
            } else {
                break;
            }
        }
        this.isRunning = false;
    }
}