# scroll-scripture-parser
A JavaScript module for parsing and normalizing Scripture references.
Used by SCROLL (the Scripture Reference Online Library) and related systems.

## Installation
```
npm i scroll-scripture-parser
```

## Usage
```javascript
const scripture = require('scroll-scripture-parser');

let references = scripture.parseScripture('John 1:1-14; 6');
let normalized = scripture.normalizeScripture('Gen 1:5; Gen 2:3; Gen 10');
let book = scripture.getBookByName('Gen');
```
