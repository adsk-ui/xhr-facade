var gulp = require('gulp'),
	wireto = require('wireto'),
	rename = require('gulp-rename'),
	slash = require('slash'),
	wiredep = require('wiredep');

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
		.pipe(gulp.dest('test'));
});
gulp.task('watch', function(){
	gulp.watch(['src/*.js', 'test/spec/*.js'], ['test']);
});