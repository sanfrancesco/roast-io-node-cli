![roast-logo-wordmark-black-github](https://cloud.githubusercontent.com/assets/22159102/24274347/e49d50dc-0fe4-11e7-8d3c-03a59e1b7bf3.jpg)


# Roast.io CLI

This CLI (command line interface) for https://www.roast.io lets you deploy JavaScript single page apps (React, Angular, Ember, and more) from your command line (terminal)

## Installation

```bash
npm install roast -g
```

## Usage

Deploy a "single page app" JavaScript project that lives in `my-project` and builds to `dist` directory:

```bash
cd my-project/
roast deploy dist
```

## Configuration and Authentication

The first time you use the roast CLI command you'll be asked to authenticate.

Your access token is stored in `~/.roast/config`.

Roast also stores a local `.roast` file in the folder where you run `roast deploy` from where the `site_id` is stored.

## From CI

1. When you push your app to your CI server, the project directory needs the local `.roast` file (it has 2 things: `site_id`, and `path`)
2. Set the `ROAST_TOKEN` environment variable to your API token (found either in ~/.roast/config) or in the https://www.roast.io web UI after signing in

