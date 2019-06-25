# kiali-bot

[![Build Status](https://travis-ci.com/kiali/kiali-bot.svg?branch=master)](https://travis-ci.com/kiali/kiali-bot)

The _kiali-bot_ is a NodeJs application to automate some of the
workflow of the [Kiali project](https://www.kiali.io). It is built
with the [Probot](https://probot.github.io/) framework.

At the time of writing, _kiali-bot_ is enabled in the
[kiali back-end](https://github.com/kiali/kiali) and 
[kiali front-end](https://github.com/kiali/kiali-ui) repositories.

## Features

The current feature set is:

* Automate merging post-release PRs.
  * An example PR is:  https://github.com/kiali/kiali/pull/1149
* Assigning a milestone to PRs when it's merged.
* Sending notification e-mails after a new version of Kiali is released. 

## Contributing

**A word of warning:** _kiali-bot_ is under automated continuous delivery.
Contributions are more than welcome. We only ask you to keep the `master`
branch as stable as possible.

If you want to contribute to the code, don't hesitate to open a PR.
Please, check the [Contributing Guide](CONTRIBUTING.md) which has detailed
steps to setup a development environment.

If you have improvement suggestions, or want to report a bug, have questions,
or want to make a compliment :smirk:, please open an issue. At the time of
writing, the issue [tracker at the kiali back-end
repository](https://github.com/kiali/kiali/issues) is being shared to file
issues.

Any kind of contribution is very welcome!

## License

This code is under the Apache License 2.0. See the [LICENSE](LICENSE) file. 
