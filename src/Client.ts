import * as msgpack from "msgpack-lite";
import { Signal } from "signals.js";

import * as cookie from "./Cookie";
import { Protocol } from "./Protocol";
import { Room } from "./Room";
import { Connection } from "./Connection";

export class Client {
    public id?: string;

    // signals
    public onOpen: Signal = new Signal();
    public onMessage: Signal = new Signal();
    public onClose: Signal = new Signal();
    public onError: Signal = new Signal();

    protected connection: Connection;
    protected room: Room;
    protected rooms: {[id: string]: Room} = {};

    constructor (url: string) {
        this.connection = new Connection(url);
        this.connection.onmessage = this.onMessageCallback.bind(this);
        this.connection.onclose = (e) => this.onClose.dispatch();
        this.connection.onerror = (e) => this.onError.dispatch();

        // check for id on cookie
        this.connection.onopen = () => {
            console.log("onopen!");
            let colyseusid = cookie.getItem('colyseusid');
            if (colyseusid) {
                this.id = colyseusid;
                this.onOpen.dispatch();
            }
        }
    }

    join<T> (roomName: string, options: any = {}): Room<T> {
        this.room = new Room<T>(roomName);

        this.connection.send([Protocol.JOIN_ROOM, roomName, options]);

        return this.room;
    }

    /**
     * @override
     */
    protected onMessageCallback (event) {
        let message = msgpack.decode( new Uint8Array(event.data) );
        let code = message[0];

        if (code == Protocol.USER_ID) {
            cookie.setItem('colyseusid', message[1]);
            this.id = message[1];
            this.onOpen.dispatch();

        } else if (code == Protocol.JOIN_ROOM) {
            let room = this.room;
            room.id = message[1];
            room.connect(new Connection(`${ this.connection.url }/${ this.room.id }`));
            room.onLeave.add(() => delete this.rooms[room.id]);

            this.rooms[room.id] = room;

        } else if (code == Protocol.JOIN_ERROR) {
            console.error("server error:", message[2]);

            // general error
            this.onError.dispatch(message[2]);

        } else {
            this.onMessage.dispatch(message);
        }

    }

}
