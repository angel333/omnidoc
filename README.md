# omnidoc

Flat-file one-way "database".

---

[![Build Status](https://travis-ci.org/angel333/omnidoc.svg?branch=master)](https://travis-ci.org/angel333/omnidoc)

Omnidoc is a parser for a flat-file structure.

## Features

- Document inheritance (see [underscore files](#underscore))
- Document classes based on their extensions
- Macro system (`$...`)
- Supported formats:
    - Markdown (with optional TOML, JSON or YAML front matter)
    - TOML
    - JSON
    - YAML
    - Plain text files
- Fields in documents can import files (or sets of files, globbing is supported) in various ways:
    - File contents (`@...`<!-- or `data:` -->)
    - SHA1 hash of the file contents (`#...`<!-- or `sha1:` -->)
    <!-- - Object from a JSON, YAML or TOML (`%` or `doc:`) -->
    <!-- - Tables from CSV -->

## License

[MIT](LICENSE)