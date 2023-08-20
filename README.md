# CSGO-Inspect
CSGO-Inspect is a typescript library that allows you to obtain float and other information related to an item on CSGO using its inspect link.

Since a single CSGO user can only get one item every 1-3 seconds, a queue is used to facilitate managing the multiple item requests needed. In addition, multiple CSGO users or bots can be used as workers and items can either be requested in bulk or one by one.