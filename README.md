# Pusher Realtime Product Hunt API

[Pusher](http://pusher.com) Realtime Product Hunt API, allowing you to subscribe to a live feed of new posts.


## Chrome extension

You can see the API in action by [installing the Realtime Product Hunt Chrome extension](https://chrome.google.com/webstore/detail/realtime-product-hunt/cbcmhcjgmcclchcebjlfgpeedjcgjfib?hl=en&gl=GB).


## API overview

Here is an overview of the API:

- The Pusher application key for the Realtime Product Hunt API is `7c1db8905b12d9aa6a03`
- New posts are published to the `ph-posts` [channel](http://pusher.com/docs/client_api_guide/client_channels) using the `new-post` [event](http://pusher.com/docs/client_api_guide/client_events)
- Posts are formatted using the Product Hunt API JSON structure (below)

```javascript
{
  "id": 716119,
  "name": "Srvd",
  "tagline": "Show different content on your website based on visitors.",
  "created_at": "2014-08-22T02:57:56.029-07:00",
  "day": "2014-08-22",
  "comments_count": 0,
  "votes_count": 1,
  "discussion_url": "http://www.producthunt.com/posts/srvd",
  "redirect_url": "http://www.producthunt.com/l/26ae9f8cb4/89",
  "screenshot_url": {
    "300px": "http://api.url2png.com/v6/P5329C1FA0ECB6/c9f841d98f79bbdc05d5b19bcd1fc5d9/png/?thumbnail_max_width=300&url=http%3A%2F%2Fwww.srvd.co%2F",
    "850px": "http://api.url2png.com/v6/P5329C1FA0ECB6/9aa037f361db622fc00cc9e8679608c0/png/?url=http%3A%2F%2Fwww.srvd.co%2F"
  },
  "current_user": {
    "voted_for_post": false,
    "commented_on_post": false
  },
  "maker_inside": false,
  "user": {
    "id": 79,
    "name": "Kevin William David",
    "headline": "Co-Founder,WalletKit",
    "created_at": "2013-12-05T07:01:30.884-08:00",
    "username": "kwdinc",
    "image_url": {
      "48px": "http://pbs.twimg.com/profile_images/378800000603512208/739e6bca8ce5ea41fa01453fd865978c_normal.jpeg",
      "73px": "http://pbs.twimg.com/profile_images/378800000603512208/739e6bca8ce5ea41fa01453fd865978c_bigger.jpeg",
      "original": "http://pbs.twimg.com/profile_images/378800000603512208/739e6bca8ce5ea41fa01453fd865978c.jpeg"
    },
    "profile_url": "http://www.producthunt.com/kwdinc"
  }
}
```


## Using the API

The Realtime Product Hunt API has been built with simplicity in mind. All you need to do is subscribe using [one of Pusher's free platform libraries](http://pusher.com/docs/libraries) and decide what you want to do with each post.

[Here's an example](http://jsbin.com/sikel/2/edit?html,js,console) that uses JavaScript and outputs each new post to the browser console:

```html
<!-- Include the Pusher JavaScript library -->
<script src="http://js.pusher.com/2.2/pusher.min.js"></script>

<script>
  // Open a Pusher connection to the Realtime Product Hunt API
  var pusher = new Pusher("7c1db8905b12d9aa6a03");

  var phChannel = pusher.subscribe("ph-posts");

  // Listen for new posts
  phChannel.bind("new-post", function(post) {
    // Output post to the browser console
    console.log(post);
  });
</script>
```
