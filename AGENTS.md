# Project Defaults

- Prefer clear structure and naming over comments; add comments or extra documentation only for complex decisions.
- Delegate when specialized expertise is needed, scope spans more than two files, or requirements are ambiguous; avoid delegation for tiny or single-file changes.
- Parallelize only for independent tasks with no shared artifacts or ordering dependencies; keep sequential in cost-sensitive mode unless parallelization is clearly required.
- This repo is a template/installer for an agent team suite to be used in other projects; runtime logs and state live in the target project, not here.
