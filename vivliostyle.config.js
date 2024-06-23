module.exports = {
  title: 'it-quiz',
  author: 'Koki Takahashi <hakatasiloving@gmail.com>',
  language: 'ja',
  size: 'A5',
  theme: '@vivliostyle/theme-base@^1.0.1', // .css or local dir or npm package. default to undefined.
  entry: [
    'manuscript.html', // `title` is automatically guessed from the file (frontmatter > first heading).
  ],
  // entryContext: './manuscripts', // default to '.' (relative to `vivliostyle.config.js`).
  output: [
    './it-quiz.pdf',
    {
      path: './book',
      format: 'webpub',
    },
  ],
  // workspaceDir: '.vivliostyle', // directory which is saved intermediate files.
  // toc: true, // whether generate and include ToC HTML or not, default to 'false'.
  // cover: './cover.png', // cover image. default to undefined.
  // vfm: { // options of VFM processor
  //   hardLineBreaks: true, // converts line breaks of VFM to <br> tags. default to 'false'.
  //   disableFormatHtml: true, // disables HTML formatting. default to 'false'.
  // },
}
