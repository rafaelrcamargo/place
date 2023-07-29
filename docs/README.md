# r/place

Place is a collaborative pixel art canvas, where users can place a pixel every 5 minutes. The canvas is 1000x1000 pixels, and each pixel can be one of 16 colors. See [r/place](https://www.reddit.com/r/place/) for more information.

> Garlic bread, Huh? 🥖🧄

## Lore

The whole story starts as a April Fools' joke by Reddit. The canvas was open for 72 hours, and the result was amazing. The canvas was filled with art, memes, flags, and more. The canvas was a huge success, it was even featured in the news. And every now and then, the canvas is brought back to life. Every time with a new codename...

## The challenge

My starting point was the [r/place](https://www.reddit.com/r/place/) subreddit. I wanted to re-create the canvas, but with all the advantages and freedom of a side project _(And all the disadvantages, cof cof)_.

### Milestones

- [x] Create a canvas
  - [x] Make it interactive
- [ ] Create scalable infrastructure
  - [ ] Setup a database (Redis [bitfield])
  - [ ] Create a backend (Not sure)

#### The canvas

The canvas is a 1000x1000 grid, but for artistic reasons, I decided to make this in a smaller scale, not the original 50x50 for pixel downscaled as the original. I decided to make it 10x10, so the canvas is upscaled and the pixels are bigger kept in memory, that way, we skip the whole image creation process and keep a reasonable performance.

#### The infrastructure

That's a cool one, my first thought was to create something scalable to the tens of millions of users, but then I realized I not so sure even how to simulate that... So for now I'm aiming for a 1.000.000 req/sec, this still sounds a bit far fetched, but I think it's a good guiding line.

## References

- [r/place](https://www.reddit.com/r/place/) - The original canvas
- [how_we_built_rplace](https://www.reddit.com/r/RedditEng/comments/vcyeqi/how_we_built_rplace/) - A fantastic series of posts about how the 2022 `r/place` was built.
- [how-we-built-rplace](https://www.redditinc.com/blog/how-we-built-rplace/) - The original post about how the 2017 `r/place` was built.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
