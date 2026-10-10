<p align="center">
  <img src="./assets/meep.png" alt="meep" width="640">
</p>

# @kanaka/pi-meep

> Fork of [adidoes/pi-meep](https://github.com/adidoes/pi-meep) that tells
> success apart from failure, so connection errors don't sound like "done".

| sound | when | length |
|---|---|---|
| **meep** (original) | run finished, waiting for you | ~0.9s |
| **error** (descending buzz) | run failed, no retries left, waiting for you | ~0.8s |
| **retry** (two short buzzes) | an attempt failed, pi is auto-retrying | ~0.2s |

Aborting with Esc/Ctrl-C makes no sound (you're already there).

How it works: pi emits `agent_end` once per attempt, including failed
attempts it is about to retry, which is why upstream meeps on every
`Connection error.`. Final sounds are played on `agent_settled`, which fires
once when pi will not continue on its own. Extensions can't see pi's
internal retry decision, so the retry sound uses a prediction that mirrors
pi's own logic (retry enabled in settings, attempts left, error is
retryable, and the context did not overflow).

Debug: `PI_MEEP_DEBUG=/tmp/meep.log pi` logs which sound each event
played. Audition the sounds: `npm run play`. Render WAVs to `out/`:
`npm run render`.

---

*Original README:*

## pi finished

## computer says meep

that is it

that is the product

zero dashboards  
zero synergy  
one noise  
immense shareholder value

## acquire creature

```bash
pi install git:github.com/kanaka/pi-meep
```

reload the beast:

```text
/reload
```

local goblin mode:

```bash
pi install /absolute/path/to/pi-meep
```

## does it boot

```bash
npm run check
```

## License

MIT

meep responsibly
