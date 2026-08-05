import { BaseOutputParser } from "@langchain/core/output_parsers";

type ListLineOutputParserOptions = {
  key: string;
};

class ListLineOutputParser extends BaseOutputParser<string[]> {
  lc_namespace = [
    "futureSearch",
    "outputParsers",
  ];

  private readonly key: string;

  constructor({
    key,
  }: ListLineOutputParserOptions) {
    super();
    this.key = key;
  }

  async parse(text: string): Promise<string[]> {
    const openingTag = `<${this.key}>`;
    const closingTag = `</${this.key}>`;

    const startIndex = text.indexOf(openingTag);
    const endIndex = text.indexOf(closingTag);

    let content = text;

    if (
      startIndex !== -1 &&
      endIndex !== -1 &&
      endIndex > startIndex
    ) {
      content = text.slice(
        startIndex + openingTag.length,
        endIndex,
      );
    }

    return content
      .split("\n")
      .map((line) =>
        line
          .replace(/^[-*•]\s*/, "")
          .replace(/^\d+[.)]\s*/, "")
          .trim(),
      )
      .filter((line) => line.length > 0);
  }

  getFormatInstructions(): string {
    return `Return one item per line inside <${this.key}> and </${this.key}> tags.`;
  }
}

export default ListLineOutputParser;