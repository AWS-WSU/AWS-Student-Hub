declare module 'bad-words' {
  export default class Filter {
    isProfane(input: string): boolean;
    clean(input: string): string;
  }
}
