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
//      Examples: 'readNumericLiteral' for the phase 'Lex', or 'parseRecord' for the phase 'Parse'.
// id:
//      Dynamic string.
//      Used to guarantee uniqueness, defaults to an auto incrementing integer.
//      If we ever run into an integer overflow issue then we could look into a GUID generating library.
// message:
//      Static string.
//      Identifies what portion of a task you're in.
//      Examples: 'entry', 'partialEvaluation', 'traceExit'.
// maybeDetails:
//      Nullable object that is JSON serializable.
//      Contains dynamic data, such as function arguments.
//
// Example where each time the tracer emits a value it'll append to the local message.
// let message = "";
// const benchmarkTraceManager = new BenchmarkTraceManager((entry: string) => (message += entry), "\t");
//
// function foobar(x: number): void {
//     const trace: BenchmarkTrace = BenchmarkTraceManager.entry("Example", foobar.name, { x, messageLength: message.length });
//     // ...
//     benchmarkTraceManager.endTrace(trace);
// }
//
// foobar(10);

// Used for either the phase or as a key in the details record.
export const enum TraceConstant {
    ArrayContents = "ArrayContents",
    ArrayLength = "ArrayLength",
    Disambiguation = "Disambiguation",
    IsError = "IsError",
    IsFieldTypeSpecification = "isFieldTypeSpecification",
    IsOperatorPresent = "IsOperatorPresent",
    IsRecursive = "IsRecursive",
    IsThrowing = "IsThrowing",
    Parse = "Parse",
    Result = "Result",
    TokenIndex = "TokenIndex",
}

export abstract class TraceManager {
    protected readonly createIdFn: () => string = createAutoIncrementId();

    constructor(private readonly valueDelimiter: string = "\t") {}

    abstract emit(trace: Trace, message: string, maybeDetails?: {}): void;

    // Creates a new instance of Trace.
    // Should be called at the start of a function.
    public entry(phase: string, task: string, maybeDetails?: {}): Trace {
        const trace: Trace = this.create(phase, task);
        this.emit(trace, Message.entry, maybeDetails);

        return trace;
    }

    // Should be called at the end of a function.
    public exit(trace: Trace, maybeDetails?: {}): void {
        this.emit(trace, Message.TraceExit, maybeDetails);
    }

    protected formatMessage(trace: Trace, message: string, maybeDetails?: {}): string {
        const details: string = maybeDetails !== undefined ? this.safeJsonStringify(maybeDetails) : "[Empty]";

        return [trace.phase, trace.task, trace.id, message, details].join(this.valueDelimiter);
    }

    // The return to the TraceManager.start function.
    // Subclass this when different values are needed in the tracer, eg. BenchmarkTraceManager/BenchmarkTrace.
    protected create(phase: string, task: string): Trace {
        return new Trace(this.emit, phase, task, this.createIdFn());
    }

    protected safeJsonStringify(obj: {}): string {
        try {
            return JSON.stringify(obj);
        } catch (e) {
            return "[JSON.serialize exception]";
        }
    }
}

// Formatted traces are sent to the given callback.
export class ReportTraceManager extends TraceManager {
    constructor(private readonly outputFn: (message: string) => void, valueDelimiter: string = "\t") {
        super(valueDelimiter);
    }

    emit(trace: Trace, message: string, maybeDetails?: {}): void {
        this.outputFn(this.formatMessage(trace, message, maybeDetails));
    }
}

// Adds calls to performanceNow() in startTrace, trace, and endTrace
export class BenchmarkTraceManager extends ReportTraceManager {
    constructor(outputFn: (message: string) => void, valueDelimiter: string = "\t") {
        super(outputFn, valueDelimiter);
    }

    public entry(phase: string, task: string, maybeDetails?: {}): Trace {
        return super.entry(phase, task, { ...maybeDetails, timeStart: performanceNow() });
    }

    public exit(trace: BenchmarkTrace, maybeDetails?: {}): void {
        return super.exit(trace, { ...maybeDetails, timeEnd: performanceNow() });
    }

    protected create(phase: string, task: string): BenchmarkTrace {
        return new BenchmarkTrace(this.emit, phase, task, this.createIdFn());
    }
}

export class NoOpTraceManager extends TraceManager {
    emit(_tracer: Trace, _message: string, _maybeDetails?: {}): void {}

    protected create(phase: string, task: string): BenchmarkTrace {
        return new NoOpTrace(this.emit, phase, task, this.createIdFn());
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

export class NoOpTrace extends Trace {
    public trace(_message: string, _maybeDetails?: {}) {}
}

const enum Message {
    entry = "entry",
    TraceExit = "TraceExit",
}

function createAutoIncrementId(): () => string {
    let counter: number = 0;

    return () => {
        counter += 1;
        return counter.toString();
    };
}
