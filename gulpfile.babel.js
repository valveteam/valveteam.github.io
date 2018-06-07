import babelify from 'babelify';
import browserify from 'browserify';
import fm from 'front-matter';
import gulp from 'gulp';
import autoprefixer from 'gulp-autoprefixer';
import cleanCSS from 'gulp-clean-css';
import concat from 'gulp-concat';
import connect from 'gulp-connect';
import data from 'gulp-data';
import image from 'gulp-image';
import newer from 'gulp-newer';
import render from 'gulp-nunjucks-render';
import rename from 'gulp-rename';
import sass from 'gulp-sass';
import sourcemaps from 'gulp-sourcemaps';
import uglify from 'gulp-uglify';
import log from 'gulplog';
import hljs from 'highlight.js';
import marked from 'marked';
import moment from 'moment';
import markdown from 'nunjucks-markdown';
import source from 'vinyl-source-stream';
import buffer from 'vinyl-buffer';
import watchify from 'watchify';

marked.setOptions({
  highlight: function(code) {
    return hljs.highlightAuto(code).value;
  },
});

// setup the markdown support within nunjucks
function manageEnvironment(env) {
  markdown.register(env, (markdown) => {
    const processed = fm(markdown);
    const markup = marked(processed.body);

    let frontmatter = '';

    if (processed.frontmatter) {
      frontmatter = `
        <div class="frontmatter">
           <p class="author">By <a href="mailto:${processed.attributes.email}">${processed.attributes.author}</a></p>
           <p class="updated">Last Updated ${moment(processed.attributes.lastUpdated, 'DD-MM-YYYY').format('MMMM Do YYYY')}</p>
        </div>
      `;
    }

    return `
      <article class="markdown">
        ${frontmatter}
        ${markup}
      </article>
    `;
  });
}

const SASS_INCLUDE_PATHS = [
  'node_modules/foundation-sites/scss',
];

const LIB_INCLUDE_PATHS = [
  'node_modules/foundation-sites/dist/js/plugins/*',
  'node_modules/jquery/dist/*',
];

const paths = {
  images: {
    src: 'src/images/*',
    dest: 'images/',
  },
  pages: {
    src: 'src/pages/*.njk',
    dest: '.',
  },
  styles: {
    src: 'src/scss/*.scss',
    dest: 'styles/',
  },
  scripts: {
    src: 'src/js/**/*.js',
    dest: 'scripts/',
  },
};

export function images() {
  return gulp.src(paths.images.src)
    .pipe(newer(paths.images.dest))
    .pipe(image())
    .pipe(gulp.dest(paths.images.dest))
}

export function markup() {
  return gulp.src(paths.pages.src)
    .pipe(data(function () {
      return require('./src/data.json');
    }))
    .pipe(render({
      path: ['src/templates', 'md'],
      manageEnv: manageEnvironment,
    }))
    .pipe(rename(function (path) { path.extname=".html" }))
    .pipe(gulp.dest('.'));
}

function compile(watch) {
  const bundler = watchify(browserify('./src/js/main.js', { debug: true }).transform(babelify));

  function rebundle() {
    bundler.bundle()
      .on('error', log.error)
      .pipe(source('main.js'))
      .pipe(buffer())
      .pipe(sourcemaps.init({ loadMaps: true }))
      .pipe(rename('main.min.js'))
      .pipe(uglify())
      .pipe(sourcemaps.write('.'))
      .pipe(gulp.dest('./scripts'));
  }

  if (watch) {
    bundler.on('update', function() {
      console.log('-> bundling...');
      rebundle();
    });
  }

  rebundle();
}

export function lib() {
  return gulp.src(LIB_INCLUDE_PATHS)
    .pipe(gulp.dest('scripts/lib/'))
}

export function scripts() {
  compile();
}

export function watchScripts() {
  compile(true);
}

export function server() {
  connect.server({
    livereload: true,
    port: 3000,
    root: '.',
  });
}

export function styles() {
  return gulp.src(paths.styles.src)
    .pipe(sourcemaps.init())
    .pipe(sass({ includePaths: SASS_INCLUDE_PATHS }))
    .pipe(autoprefixer())
    .pipe(cleanCSS())
    .pipe(concat('main.min.css'))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(paths.styles.dest));
}

export function livereload() {
  return gulp.src([paths.styles.dest, paths.scripts.dest, '*.html'])
    .pipe(connect.reload());
}

export function watch() {
  gulp.watch('./src/scss/**/*.scss', styles);
  gulp.watch('./src/js/**/*.js', watchScripts);
  gulp.watch(['./src/data.json', './md/**/*.md', './src/pages/*.njk', './src/templates/**/*.njk'], markup);
  gulp.watch('./src/images/**/*', images);
  gulp.watch(['./styles/**/*', './scripts/**/*', '*.html'], livereload);
}

const build = gulp.parallel(server, markup, styles, scripts, watch, lib, images);
export default build;
