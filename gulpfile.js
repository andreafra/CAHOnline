// FROM: https://gist.github.com/webdesserts/5632955
// NOTE: I previously suggested doing this through Grunt, but had plenty of problems with
// my set up. Grunt did some weird things with scope, and I ended up using nodemon. This
// setup is now using Gulp. It works exactly how I expect it to and is WAY more concise.
var gulp = require('gulp'),
    spawn = require('child_process').spawn,
    sass = require('gulp-sass'),
    browserSync = require('browser-sync').create(),
    node;
/**
 * $ gulp server
 * description: launch the server. If there's a server already running, kill it.
 */
gulp.task('server', function() {
  if (node) node.kill()
  node = spawn('node', ['server.js'], {stdio: 'inherit'})
  node.on('close', function (code) {
    if (code === 8) {
      gulp.log('Error detected, waiting for changes...')
    }
  });
})

/**
 * compile scss to scss
 */
gulp.task('sass', function() {
  return gulp.src('app/scss/*.scss')
    .pipe(sass())
    .pipe(gulp.dest('app/css'))
})

/**
 * LiveReload the page every css change
 */
gulp.task('browserSync', function() {
  browserSync.init({
    proxy: {
      target: "localhost:5000"
    }
  })
})

gulp.task('reload', function() {
  browserSync.reload();
})

gulp.task('watch', function() {
  gulp.watch('server.js', ['server']);
  gulp.watch('app/**/*.scss', ['sass', 'reload']);
  gulp.watch('app/**/*.html', ['reload']);
  gulp.watch('app/js/**/*.js', ['reload']);
})

/**
 * $ gulp
 * description: start the development environment
 */
gulp.task('default', ['server', 'sass', 'browserSync', 'watch']);

// clean up if an error goes unhandled.
process.on('exit', function() {
    if (node) node.kill();
})