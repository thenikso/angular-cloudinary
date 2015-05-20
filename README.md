# AngularJS Cloudinary

A module heavily inspired (and copied) by [Cloudinary JS](https://github.com/cloudinary/cloudinary_js)
and [Cloudinary Angular](https://github.com/cloudinary/cloudinary_angular) but
**without any non-angular dependency**.

## Usage

This package is available via [Bower](http://bower.io):

```
$ bower install --save angular-cloudinary
```

Include the following in your HTML:

```html
<script src="/bower_components/ng-file-upload/ng-file-upload-shim.js"></script>
<script src="/bower_components/ng-file-upload/ng-file-upload.js"></script>
<script src="/bower_components/angular-cloudinary/angular-cloudinary.js"></script>
```

Note that you might need to follow [ng-file-upload](https://github.com/danialfarid/ng-file-upload)
setup instructions as well.

### Upload

You can now [capture file input to an angular model](https://gist.github.com/thenikso/8899bc6b760e094dd2b5)
and then, in your controller:

```javascript
angular
// Include the angular-cloudinary module
.module('myModule', ['angular-cloudinary'])
// Configure the cloudinary service
.config(function (cloudinaryProvider) {
  cloudinaryProvider.config({
    upload_endpoint: 'https://api.cloudinary.com/v1_1/', // default
    cloud_name: 'my_cloudinary_cloud_name', // required
    upload_preset: 'my_preset', // optional
  });
})
// Inject the `cloudinary` service in your controller
.controller('myController', function($scope, cloudinary) {
  // Have a way to see when a file should be uploaded
  $scope.$watch('myFile', function(myFile) {
    // Use the service to upload the file
    cloudinary.upload(myFile, { /* cloudinary options here */ })
    // This returns a promise that can be used for result handling
    .then(function (resp)) {
      alert('all done!');
    };
  });
});
```

You might want to use Cloudinary signed presets for security reason. You will need
to generate a signed set of cloudinary options with any of the backend Cloudinary
library and return that to your client AngularJS application so that it can be
fed to `cloudinary.upload`'s options.

### Display a Cloudinary image

To view an image you usually want to use the `cl-src` directive as documented in
[Cloudinary Angular](https://github.com/cloudinary/cloudinary_angular). The version
in this repository has some additions like:

- better sorting of transformation attributes to generate valid Cloudinary urls
- using `dpr="auto"` will auto-detect the current browser retina pixel ratio

A full list of available attributes documentation might be available in the future.

```
<img cl-src="my_image_public_id"
  width="100"
  height="100"
  crop="fill"
  dpr="auto"
  fetch-format="auto"
  alt="">
```

## License

Released under the MIT license.
