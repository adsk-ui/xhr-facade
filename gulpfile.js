var gulp = require('gulp'),
	wireto = require('wireto'),
	rename = require('gulp-rename'),
	slash = require('slash'),
	wiredep = require('wiredep'),
	connect = require('gulp-connect');

gulp.task('test', function(){
	return gulp.src('test/index.template.html')
		.pipe(wiredep.stream())
		.pipe(wireto('<!-- include source files here... -->', gulp.src('src/*.js'), function(filepath){
			return '<script src="'+slash('../src/'+filepath)+'"></script>';
		}))
		.pipe(wireto('<!-- include spec files here... -->', gulp.src('test/spec/*.js'), function(filepath){
			return '<script src="'+slash('spec/'+filepath)+'"></script>';
		}))
		.pipe(rename('index.html'))
		.pipe(gulp.dest('test'))
		.pipe(connect.reload());
});
gulp.task('build', function(){
	return gulp.src('src/*.js')
		.pipe(gulp.dest('dist'));
});
gulp.task('connect', function(){
	connect.server({
		root: '.',
		livereload: true
	});
});
gulp.task('watch', function(){
	gulp.watch(['src/*.js', 'test/spec/*.js'], ['test']);
});
gulp.task('default', ['connect', 'watch']);