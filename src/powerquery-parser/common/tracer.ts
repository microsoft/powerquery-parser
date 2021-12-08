// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable-next-line: no-require-imports
import performanceNow = require("performance-now");

import { MapUtils } from ".";

export interface Trace {
    readonly id: string;
    readonly message: string;
}

// phase:
//      Static string.
//      Examples: 'Lex', 'Parse', 'StaticAnalysis'
// task:
//      Static string.
//      Something that falls under the given phase. Recommended to be the name of a function.
//      Examples: 'readNumericLiteral' for 'Lex', or 'parseRecord' for 'Parse'.
// id:
//      Dynamic string.
//      Used to guarantee uniqueness on a (phase, task, id) trio.
//      Defaults to auto incrementing integer.
// message:
//      Static string.
//      Identifies what portion of a task you're in.
//      Examples: 'traceEntry', 'partialEvaluation', 'traceExit'.
// details:
//      Nullable object that is JSON serializable.
//      Contains dynamic data, such as arguments to functions.
//
// Example where each time the tracer emits a value it'll append to the local message.
// let message = "";
// const tracer = new TraceReporter("\t", (entry: string) => (message += entry));
//
// function foobar(tracer: Tracer): void {
//     const { id } = tracer.traceEntry("Example", foobar.name, { messageLength: message.length });
//     // ...
//     tracer.traceExit("Example", foobar.name, id);
// }
//
// foobar(tracer);
export abstract class Tracer {
    protected idFn: () => string;

    constructor(protected readonly valueDelimiter: string = "\t", maybeIdFn?: () => string) {
        this.idFn = maybeIdFn ?? createAutoIncrementId();
    }

    public abstract emitTrace(id: string, message: string): Trace;

    public dispose(): void {}

    public formatMessage(phase: string, task: string, id: string, message: string, maybeDetails?: {}): string {
        const details: string = maybeDetails !== undefined ? this.safeJsonStringify(maybeDetails) : "[Empty]";

        return [phase, task, id, message, details].join(this.valueDelimiter);
    }

    public trace(phase: string, task: string, id: string, message: string, maybeDetails?: {}): Trace {
        return this.emitTrace(id, this.formatMessage(phase, task, id, message, maybeDetails));
    }

    public traceEntry(phase: string, task: string, maybeDetails?: {}): Trace {
        const id: string = this.idFn();
        return this.trace(phase, task, id, Message.TraceEntry, maybeDetails);
    }

    public traceExit(phase: string, task: string, id: string, maybeDetails?: {}): Trace {
        return this.trace(phase, task, id, Message.TraceExit, maybeDetails);
    }

    protected safeJsonStringify(obj: {}): string {
        try {
            return JSON.stringify(obj);
        } catch (e) {
            return "[JSON.serialize exception]";
        }
    }
}

export class TraceReporter extends Tracer {
    constructor(deliminator: string, protected readonly outputFn: (message: string) => void) {
        super(deliminator);
    }

    public emitTrace(id: string, message: string): Trace {
        this.outputFn(message);

        return {
            id,
            message,
        };
    }
}

export class TraceBenchmarkReporter extends TraceReporter {
    private readonly timeStartById: Map<string, number> = new Map();

    constructor(deliminator: string, outputFn: (message: string) => void) {
        super(deliminator, outputFn);
    }

    public dispose(): void {
        super.dispose();
        this.timeStartById.clear();
    }

    public formatMessage(phase: string, task: string, id: string, message: string, maybeDetails?: {}): string {
        let details: {};

        if (message === Message.TraceEntry) {
            const timeStart: number = performanceNow();
            this.timeStartById.set(id, timeStart);
            details = {
                ...maybeDetails,
                timeStart,
            };
        } else if (message === Message.TraceExit) {
            const timeStart: number = MapUtils.assertGet(this.timeStartById, id, "trace exit called for unknown id", {
                phase,
                task,
                message,
                id,
                maybeDetails,
            });
            this.timeStartById.delete(id);

            const timeEnd: number = performanceNow();

            details = {
                ...maybeDetails,
                timeStart,
                timeEnd,
                timeDelta: timeEnd - timeStart,
            };
        } else {
            details = maybeDetails !== undefined ? maybeDetails : "[Empty]";
        }

        return [phase, task, id, message, details].join(this.valueDelimiter);
    }
}

const enum Message {
    TraceEntry = "TraceEntry",
    TraceExit = "TraceExit",
}

function createAutoIncrementId(): () => string {
    let counter: number = 0;

    return () => {
        counter += 1;
        return counter.toString();
    };
}
