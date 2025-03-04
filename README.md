# @certible/remark-link-extractor

Remark plugin to extract internal, external, and hash links from markdown. This remark plugin is **module only** and does not support CommonJS. Ensure your project is configured to use ES modules.

We use @[certible.com](https://www.certible.com) use this to check for broken links after an automated build of our Astro site.

## Installation

```sh
npm install @certible/remark-links-extractor
```

## Usage

```javascript
import { getData, remarkLinksExtractor } from '@certible/remark-links-extractor';
import { remark } from 'remark';
import remarkParse from 'remark-parse';

const markdown = `
# Heading 1

[Internal Link](/internal)
[External Link](https://example.com)
`;

remark()
 .use(remarkParse)
 .use(remarkLinkExtractor)
 .process(markdown, (err, file) => {
  if (err)
   throw err;
  const data = getData();
  console.log(data);
 });
```

## Plugin Options

### `astroIgnoreDraft`

Type: `boolean`
Default: `false`

Whether to ignore draft files if declared in Astro frontmatter.

### `astroUseSlug`

Type: `boolean`
Default: `false`

Whether to use the slug from Astro frontmatter and not the file path as the key.

### `createHeadingsSlug`

Type: `boolean`
Default: `false`

Whether to create a slug from the heading text if no `id` attribute is present, if `true` it will use `github-slugger` to create a slug from the heading text.

### Method `getData()`

Returns the extracted link data.

#### Returns

An object containing the following properties, as `Record<string, []string>`. The keys are the file path or slug if `astroUseSlug` is `true`. If no file path or slug is available, the key will be an ordered number.

- `headings`: Record of headings extracted from the markdown files.
- `internalLinks`: Record of internal links extracted from the markdown files.
- `externalLinks`: Record of external links extracted from the markdown files.

## License

MIT License. See [LICENSE](./LICENSE) for more information.
