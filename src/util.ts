export function objectEntries<T>(object: {[k: string]: T}) : [string, T][] {
	const output: [string, T][] = []
	for(const k in object) {
		output.push([k, object[k]])
	}
	return output
}
