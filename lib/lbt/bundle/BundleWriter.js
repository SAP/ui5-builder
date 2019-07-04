"use strict";


const NL = "\n";
const ENDS_WITH_NEW_LINE = /(^|\r\n|\r|\n)[ \t]*$/;

/**
 * A filtering writer that can count written chars and provides some convenience
 * methods when writing Javascript files.
 *
 * Most methods have been extracted from JSMergeWriter.
 *
 * columnOffset and lineOffset are used for sourcemap merging as reference to where we are at a given point in time
 *
 * @author Frank Weigel
 * @since 1.27.0
 * @private
 */
class BundleWriter {
	constructor() {
		this.buf = "";
		this.lineOffset = 0;
		this.columnOffset = 0;
		this.segments = [];
		this.currentSegment = null;
		this.currentSourceIndex = 0;
	}

	write(...str) {
		for ( let i = 0; i < str.length; i++ ) {
			this.buf += str[i];
			this.lineOffset += str[i].split(NL).length - 1;
			this.columnOffset += str[i].length;
		}
	}

	writeln(...str) {
		for ( let i = 0; i < str.length; i++ ) {
			this.buf += str[i];
		}
		this.buf += NL;
		this.lineOffset += 1;
		this.columnOffset = 0;
	}

	ensureNewLine() {
		// TODO this regexp might be quite expensive (use of $ anchor on long strings)
		if ( !ENDS_WITH_NEW_LINE.test(this.buf) ) {
			this.buf += NL;
			this.lineOffset += 1;
			this.columnOffset = 0;
		}
	}

	toString() {
		return this.buf;
	}

	get length() {
		return this.buf.length;
	}

	startSegment(module) {
		if ( this.currentSegment ) {
			throw new Error("trying to start a segment while another segment is still open");
		}
		this.currentSegment = {
			module: module,
			startIndex: this.length,
		};
		this.currentSourceIndex = this.segments.length;
	}

	endSegment() {
		if ( !this.currentSegment ) {
			throw new Error("trying to end a segment while no segment is open");
		}
		this.currentSegment.endIndex = this.length;
		this.segments.push(this.currentSegment);
		const targetSize = this.currentSegment.endIndex - this.currentSegment.startIndex;
		this.currentSegment = null;
		this.currentSourceIndex = -1;
		return targetSize;
	}
}

module.exports = BundleWriter;

