import { Event } from "nostr-tools";

export function getTagValues(e: Event, tag: string, position: number) {
  const tags = e.tags;
  const values: string[] = [];
  for (let i = 0; i < tags.length; i++) {
    if (tags[i][0] === tag) {
      values.push(tags[i][position]);
    }
  }
  return values;
}
