# Contributing to Trackaholic

Thanks for wanting to help. For anything bigger than a small fix, open an issue first so we
can agree on the approach before you write the code.

## Before you open a pull request

- Set the app up with [Running locally](README.md#-running-locally) in the README.
- Run `./scripts/check.sh`. It runs the same six gates as CI: backend tests and lint, then the
  frontend typecheck, unit tests, lint and build.
- Keep a pull request to one change. Use one commit per logical step, each building and passing
  the tests on its own, with a message that says why the change is needed.

## The licence of your contribution

By opening a pull request, you agree that:

1. You wrote the contribution yourself, or otherwise have the right to submit it on these
   terms (for example, your employer allows it).
2. Your contribution is licensed under the [MIT License](LICENSE), like the rest of the project.
3. You also grant Mohammad Abdullah, the project's maintainer, and his successors a perpetual,
   worldwide, non-exclusive, royalty-free and irrevocable licence to use, copy, modify,
   distribute, sublicense and relicense your contribution under any terms, including other
   open-source licences and commercial or proprietary ones. This includes any patent rights of
   yours that the contribution would otherwise infringe.
4. You keep the copyright in your contribution. This is a licence, not a transfer, so you stay
   free to use your own code anywhere else.

Point 3 is there so the project's licence can change in the future without having to track
down every past contributor. Versions already released stay MIT for everyone.

If you don't agree to these terms, please don't open a pull request. Open an issue describing
the change instead.
