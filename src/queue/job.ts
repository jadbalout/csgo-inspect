import { CSGOItem } from "../bot";
import { EventEmitter } from "events";
export type JobCallback = (err: any, job: Job) => void;
export enum JobState {
    Created,
    Pending,
    Completed,
    Failed
}
export class Job extends EventEmitter {
    inspectLink: string;
    id: string;
    callback?: JobCallback;
    createdAt: Date;
    data: null | CSGOItem = null;
    err?: any;
    state: JobState = JobState.Created;
    
    constructor(inspectLink: string, callback?: JobCallback) {
        super();
        this.inspectLink = inspectLink;
        this.id = Math.random().toString(36).substr(2, 9);
        this.createdAt = new Date();
        this.callback = callback;
        //Kill job after 30 seconds
        setTimeout(() => {
            if(this.state == JobState.Created) {
                this.fail('Job timed out.');
            }
        }, 30000);
    }

    fail(err: any) {
        this.state = JobState.Failed;
        this.err = err;
        if(this.callback) this.callback(err, this);
        this.emit('failed', err);
    }
}