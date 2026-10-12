# Pinned generator inputs

`native_arrow_base.json` is the M0 owner-tested custom arrow starting point,
derived from Bedrock 1.26.50's ordinary vanilla player/mob arrow definition.
Crossbow branches were omitted for the custom bow. `make_galadhrim_archery.py`
sets the final identifier from `gift_rules.js`.

The source was moved from ignored M0 scratch into this repository so a fresh
checkout can regenerate the final arrow. The generated packs are byte-identical.
Other native assets come from the workspace's regenerated vanilla reference.
