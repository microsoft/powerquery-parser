// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable-next-line: no-require-imports
import performanceNow = require("performance-now");

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
// maybeDetails:
//      Nullable object that is JSON serializable.
//      Contains dynamic data, such as arguments to functions.
//
// Example where each time the tracer emits a value it'll append to the local message.
// let message = "";
// const benchmarkTraceManager = new BenchmarkTraceManager((entry: string) => (message += entry), "\t");
//
// function foobar(x: number): void {
//     const trace: BenchmarkTrace = BenchmarkTraceManager.traceEntry("Example", foobar.name, { x, messageLength: message.length });
//     // ...
//     benchmarkTraceManager.endTrace(trace);
// }
//
// foobar(10);

export abstract class TraceManager {
    protected readonly createIdFn: () => string = createAutoIncrementId();

    constructor(private readonly valueDelimiter: string = "\t") {}

    abstract emitTrace(tracer: Trace, message: string, maybeDetails?: {}): void;

    // Creates a new trace instance.
    // Should be called at the start of a function.
    public startTrace(phase: string, task: string, maybeDetails?: {}): Trace {
        const tracer: Trace = this.createTrace(phase, task);
        this.emitTrace(tracer, Message.TraceEntry, maybeDetails);

        return tracer;
    }

    // Should be called at the end of a function.
    public endTrace(trace: Trace, maybeDetails?: {}): void {
        this.emitTrace(trace, Message.TraceExit, maybeDetails);
    }

    protected formatMessage(trace: Trace, message: string, maybeDetails?: {}): string {
        const details: string = maybeDetails !== undefined ? this.safeJsonStringify(maybeDetails) : "[Empty]";

        return [trace.phase, trace.task, trace.id, message, details].join(this.valueDelimiter);
    }

    // Subclass this as needed. See BenchmarkTraceManager and BenchmarkTrace for example.
    protected createTrace(phase: string, task: string): Trace {
        return new Trace(this.emitTrace, phase, task, this.createIdFn());
    }

    protected safeJsonStringify(obj: {}): string {
        try {
            return JSON.stringify(obj);
        } catch (e) {
            return "[JSON.serialize exception]";
        }
    }
}

export class ReportTraceManager extends TraceManager {
    constructor(private readonly outputFn: (message: string) => void, valueDelimiter: string = "\t") {
        super(valueDelimiter);
    }

    emitTrace(trace: Trace, message: string, maybeDetails?: {}): void {
        this.outputFn(this.formatMessage(trace, message, maybeDetails));
    }
}

export class BenchmarkTraceManager extends ReportTraceManager {
    constructor(outputFn: (message: string) => void, valueDelimiter: string = "\t") {
        super(outputFn, valueDelimiter);
    }

    public startTrace(phase: string, task: string, maybeDetails?: {}): Trace {
        return super.startTrace(phase, task, { ...maybeDetails, timeStart: performanceNow() });
    }

    public endTrace(trace: BenchmarkTrace, maybeDetails?: {}): void {
        return super.endTrace(trace, { ...maybeDetails, timeEnd: performanceNow() });
    }

    protected createTrace(phase: string, task: string): BenchmarkTrace {
        return new BenchmarkTrace(this.emitTrace, phase, task, this.createIdFn());
    }
}

export class Trace {
    constructor(
        protected readonly emitTraceFn: (trace: Trace, message: string, maybeDetails?: {}) => void,
        public readonly phase: string,
        public readonly task: string,
        public readonly id: string,
    ) {}

    public trace(message: string, maybeDetails?: {}) {
        this.emitTraceFn(this, message, maybeDetails);
    }
}

export class BenchmarkTrace extends Trace {
    constructor(
        emitTraceFn: (trace: Trace, message: string, maybeDetails?: {}) => void,
        phase: string,
        task: string,
        id: string,
    ) {
        super(emitTraceFn, phase, task, id);
    }

    public trace(message: string, maybeDetails?: {}) {
        this.emitTraceFn(this, message, {
            ...maybeDetails,
            timeNow: performanceNow(),
        });
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
