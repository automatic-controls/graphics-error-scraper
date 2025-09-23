# graphics-error-scraper

> WebCTRL is a trademark of Automated Logic Corporation. Any other trademarks mentioned herein are the property of their respective owners.

## Overview

**graphics-error-scraper** is a tool designed to automatically check whether any graphics in a WebCTRL system are displaying errors. This is especially useful for system administrators and operators who want to proactively monitor the health of their WebCTRL graphics. It has been tested on WebCTRL 8.0, 8.5, 9.0, and 10.0.

> **Note:** This project relies on [Puppeteer](https://pptr.dev/), a Node.js library that automates the Chrome browser. Chrome is used behind the scenes to interact with the WebCTRL system as a real user would.

## Installation

1. Download the latest release from the following link:
   [graphics-error-scraper.zip](https://github.com/automatic-controls/graphics-error-scraper/releases/latest/download/graphics-error-scraper.zip)
   - This will work only for 64-bit Windows OS.
   - For other operating systems, you are free to build from source.
2. Unzip the contents to a convenient location on your computer.

## Usage

Run the tool from the command line with the following options:

```
Usage: graphics-error-scraper [options]
  -u, --url <url>             Target URL (required)
  -U, --username <username>   Username (required)
  -p, --password <password>   Password (required)
  -o, --output <file>         Output file (default: errors.json, use - for stdout)
  -f, --force                 Overwrite output file if it exists
  -i, --ignoressl             Ignore SSL certificate errors (required for insecure HTTP)
  -t, --timeout <ms>          Timeout for page actions in milliseconds (default: 180000)
  -h, --headless <bool>       Headless mode (true/false, default: true)
  -v, --verbose               Verbose logging (flag or "true")
      --version, -v           Print version and exit
```

> **Note:** For this tool to function correctly, the WebCTRL user account must have the **Automatically collapse trees** option unchecked in his or her settings.

### Example

```
graphics-error-scraper -u https://webctrl.example.com -U admin -p hvac1234 -o results.json
```

- The tool will log in to the specified WebCTRL system, expand all geographic tree nodes, and check each graphic for errors.
- Results are saved to the specified output file in JSON format, or printed to the console if `-o -` is used.