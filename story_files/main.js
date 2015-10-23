$(function() {
	var scene_tpl = $('#template').html();
	var frame_tpl = $(scene_tpl).find('.frame').wrap('<p>').parent().html();
	var overlay_tpl = $('#overlay-tpl').html();

	var body = $('body'),
		header = $('.header'),
		story = $('.story'),
		isDragging = false,
		haveChanged = false,
		isExport = false,
		linkedFrames = null,
		sortableParts = [];

	// activate management and contenteditable
	body.removeClass('nomanagement');
	$('*[contenteditable]').attr('contenteditable', true);



	//*/// import / export

	$('.btn-edit')
		.on('dragstart', function (event) {
			isExport = true;
			var data = event.originalEvent.dataTransfer;
			data.setData('text/html', story.html());
			data.setData('title', getTitle());
			console.log('export', getTitle());
			$(this).addClass('export');
		}).on('dragenter', function (event) {
			if(!isExport) $(this).addClass('import');
		}).on('dragleave', function (event) {
			if(!isExport) $(this).removeClass('import');
		}).on('dragend', function(event){
			$(this).removeClass('export');
		}).on('drop', function(event){
			// import
			if(!isExport) {
				var data = event.originalEvent.dataTransfer;
				$this = $(this);
				$this.toggleClass('loading import');
				setTitle(data.getData('title'))
				console.log('imported',data.getData('title'));
				story.html(data.getData('text/html')).promise().done(function(){
					setTimeout(function () {
						$this.removeClass('loading');
						setChanged();
					}, 500);
				});
			}
			isExport = false;
			event.preventDefault();
		});


	//*/// changes

	function setSaved() {
		if(!haveChanged) return;
		body.removeClass('changed');
		haveChanged = false;
		setTitle();
		console.log('(file probably saved)');
	}
	function setChanged() {
		if(haveChanged) return;
		body.addClass('changed');
		haveChanged = true;
		setTitle();
		console.log('(content have changed)');
	}
	function getTitle () {
		return $('.header-title').text() || 'Untitled';
	}
	function setTitle (title) {
		if(typeof title === 'string') {
			$('.header-title').text(title);
		} else title = getTitle();
		var prefix = haveChanged ? '(not saved) ' : '';
		document.title = prefix + title;
	}
	body.delegate('*[contenteditable]', 'input', setChanged);
	$('.header-title').on('input', setTitle);

	$(window).bind('beforeunload', function(){
		if(haveChanged)
			return 'Any changes to the storyboard will be lost.';
	});


	//*/// drop images

	story.delegate('.frame', 'dragenter', delOverlay);
	story.delegate('.frame img', 'dragenter', function(e){
		if(!isDragging) {
			e.stopPropagation();
			e.preventDefault();
			$(this).addClass('dragenter');
		}
	});
	story.delegate('.frame img', 'dragleave', function(e){
		if(!isDragging) $(this).removeClass('dragenter');
	});
	story.delegate('.frame img', 'dragover', function(e){
		if(!isDragging) {
			e.stopPropagation();
			e.preventDefault();
		}
	});
	story.delegate('.frame img', 'drop', function(event){
		if(isDragging) return;
		event.preventDefault();
		var files = event.originalEvent.dataTransfer.files,
			target = $(this),
			frame, newframe;
		for (var i = 0; i < files.length; i++){
			var load = loadImage(files[i], target);
			if(!load) continue;
			frame = newframe = target.closest('.frame');
			if(frame.hasClass('shadow')) 
				newframe = revealFrame(target);
			else if(i < files.length -1 ) {
				newframe = newFrame();
				frame.after(newframe);
			}
			target = newframe.find('img');
		}
	});

	function loadImage (file, img) {
		var frame = img.parents('.frame');
		img.removeClass('dragenter');

		// not a supported image
		var authorized = ['image/jpeg', 'image/gif', 'image/png'];
		if(file === undefined || authorized.indexOf(file.type) == -1) {
			frame.addClass('notimage');
			setTimeout(function () {
				frame.removeClass('notimage');
			}, 200);
			console.log('not an image');
			return false;
		}
		// let's go
		console.log('load', file.name);
		var reader = new FileReader();
		reader.readAsDataURL(file);
		reader.addEventListener('loadend', function (e, f) {
			var canvas = document.createElement('canvas'),
				context = canvas.getContext('2d')
				image = new Image();
			image.src = this.result;
			image.onload = function() {
				var width = this.width,
					height = this.height,
					max = 4000;
				// set pano mode
				if(width > 2 * height) {
					frame.addClass('ispano');
					console.log('enable pano mode');
				}
				// animate
				frame.addClass('dropped');
				setTimeout(function () {
					frame.removeClass('dropped');
				}, 500);
				// limit size
				if(width > max) {
					console.log('resize width', width);
					width = max;
					height = width * (this.height / this.width);
				}
				if(height > max) {
					console.log('resize height', height);
					height = max;
					width = height * (this.width / this.height);
				}
				canvas.width = width;
				canvas.height = height;
				context.scale(width / this.width, height / this.height);
				context.drawImage(this, 0, 0);
				img.attr('src', canvas.toDataURL(file.type, 0.25));
			};
		}, false);
		return true;
	}

	$(window).on('dragover', function(e){
		e.preventDefault();
	});
	$(window).on('drop', function(event){
		event.preventDefault();
	});



	//*/// add

	$('.scene').each(function () {
		revealScene($(this));
	});
	addShadowScene();

	story.delegate('.scene.shadow .scene-header *[contenteditable]', 'input', function(e){
		revealScene($(this));
	});
	story.delegate('.add-frame-before', 'click', function(e){
		$(this).closest('.scene').find('.frames').prepend(newFrame());
		setChanged();
		console.log('prepend a frame');
	});
	story.delegate('.add-frame', 'click', function(e){
		var shadow = $(this).closest('.scene').find('.frame.shadow');
		revealFrame(shadow);
	});
	body.delegate('.frame.shadow *[contenteditable]', 'input', function(e){
		revealFrame($(this));
	});
	function newShadowFrame () {
		return $(frame_tpl);
	}
	function newFrame () {
		return unShadow(newShadowFrame());
	}
	function newShadowScene () {
		return $(scene_tpl);
	}
	function newScene () {
		return unShadow(newShadowScene());
	}
	function isShadow (el) {
		return el.hasClass('shadow');
	}
	function unShadow (el) {
		return el.removeClass('shadow management');
	}
	function addShadowScene () {
		// add a new shadow scene if needed
		var shadowscene = story.find('.scene.shadow');
		if(shadowscene.length === 0) {
			shadowscene = newShadowScene();
			story.find('.scenes').append(shadowscene);
			initFramesSort();
			console.log('add a new shadow scene');
		}
		return shadowscene;
	}
	function revealScene (scene) {
		if(!scene.hasClass('scene'))
			scene = scene.closest('.scene');
		if(isShadow(scene)) {
			unShadow(scene);
			console.log('reveal a scene');
			setChanged();
		}
		// add a new shadow frame if needed
		var shadowframe = scene.find('.shadow');
		if(shadowframe.length === 0) {
			scene.find('.frames').append(newShadowFrame());
			console.log('add a new shadow frame');
		}
		return addShadowScene();
	}
	function revealFrame (frame) {
		if(!frame.hasClass('frame'))
			frame = frame.closest('.frame');
		if(isShadow(frame)) {
			unShadow(frame);
			console.log('reveal a frame');
			setChanged();
		}
		revealScene(frame);
		return frame.parent().find('.shadow');
	}



	//*/// case overlay

	function overlay (el){
		var existing = $('.overlay');
		if(existing.length) existing.remove();
		else el.parent().prepend(overlay_tpl);
	}
	function delOverlay(){
		$('.overlay').remove();
	}
	$(window).on('click', function(event) {
		delOverlay();
		var target = $(event.target);
		if(target.is('img') && target.parents('.frame.shadow').length === 0) {
			overlay(target);
		}
	});
	story.delegate('.overlay .delete', 'click', function(e){
		var $case = $(this).closest('.frame');
		$case.addClass('remove');
		setTimeout(function(){
			$case.remove();
		}, 200);
		setChanged();
	});
	story.delegate('.frame *[data-toggle]', 'click', function(e){
		var $this = $(this);
		$this.closest('.frame')
			.toggleClass($this.data('toggle'))
			.find('img')
				.removeAttr('style');
		setChanged();
	});



	//*/// part delete

	story.delegate('.scene-delete', 'click', function(e){
		var part = $(this).closest('.scene');
		part.addClass('hidemanagement')
			.animate({
				opacity: 0, height: 0
			}, function() {
				part.remove();
				setChanged();
			});
	});



	//*/// sortable

	Sortable.create(document.querySelector('.scenes'), {
		animation: 100,
		draggable: '.scene',
		handle: '.scene-handle',
		ghostClass: 'dragged',
		onStart: function (evt) {
			isDragging = true;
			$('.scene').addClass('closed-tmp');
		},
		onEnd: function (evt) {
			isDragging = false;
			$('.scene').removeClass('closed-tmp');
		},
		onSort: function (evt) {
			setChanged();
			// moved shadow, or after shadow
			var item = $(evt.item);
			if(item.hasClass('shadow')) revealScene(item);
			if(item.prev().hasClass('shadow')) revealScene(item.prev());
		}
	});
	function initFramesSort() {
		// destroy old ones
		for (var i = 0; i < sortableParts.length; i++) {
			sortableParts[i].destroy();
		}
		sortableParts.length = 0;
		// make new ones
		$('.frames').each(function (el) {
			sortableParts.push(Sortable.create($(this).get(0), {
				group: 'frames',
				draggable: '.frame',
				handle: '.frame-img',
				chosenClass: 'dragged',
				ghostClass: 'dragged',
				animation: 0,
				onStart: function (evt) {
					isDragging = true;
					tagSiblingsOf($(evt.item));
					delOverlay();
				},
				onEnd: function (evt) {
					isDragging = false;
					manageMoves($(evt.item));
					revealScene($(evt.from));
					revealFrame($(evt.item));
				},
				onSort: function (evt) {
					setChanged();
				}
			}));
		});
	}

	function tagSiblingsOf(item) {
		// tag the frames which are in the same shot
		// that the given item (cf. manageMoves)
		item.nextUntil(':not(.sameshot)')
			.addClass('linked after');
		if(item.hasClass('sameshot')) {
			item.prevUntil(':not(.sameshot)')
				.andSelf().prev()
				.addClass('linked before');
		}
	}
	function manageMoves(item) {
		// manage global behaviors of :
		// - frames moved in their shot,
		// - frames moved in/out a shot,
		// - all a shot moved at once.
		// - shadow frame moved
		// - frame moved after the shadow
		var linked = $('.linked'),
			next = item.next(),
			prev = item.prev(),
			prevIsMyShot = prev.hasClass('linked'),
			nextIsMyShot = next.hasClass('linked'),
			nextHaveSameshot = next.hasClass('sameshot'),
			haveSameshot = item.hasClass('sameshot');

		// moved shadow, or after shadow
		if(item.hasClass('shadow')) revealFrame(item);
		if(prev.hasClass('shadow')) revealFrame(prev);

		// item was in a shot
		if(linked.length != 0) {
			// moved at the head of its shot
			if(nextIsMyShot && !prevIsMyShot) {
				item.removeClass('sameshot');
				next.addClass('sameshot');
				console.log('frame moved 1st of its shot');
			}
			// was the first : others follow the chosen one
			else if(!prevIsMyShot && !haveSameshot) {
				$('.linked.before').detach().insertBefore(item);
				$('.linked.after').detach().insertAfter(item);
				console.log('shot moved (linked follows)');
			}
			// moved outside of its shot
			else if(!prevIsMyShot && !nextIsMyShot) {
				item.removeClass('sameshot');
				console.log('frame extracted of a shot');
			}
			linked.removeClass('linked before after');
		}
		// is inserted in a shot
		if(nextHaveSameshot) {
			item.addClass('sameshot');
			console.log('frame inserted in a shot');
		}
	}
	initFramesSort();



	//*/// shortcuts

	function cleanup() {
		var attrs = [
			'data-sortable-id', 'data-item-sortable-id',
			'role', 'aria-grabbed', 'aria-dropeffect',
			'draggable', 'style'];
		$.each(attrs, function(id, val){
			$('*['+val+']').removeAttr(val);
		});
	}
	$(window).on('keydown', function(event) {
		if (!event.ctrlKey && !event.metaKey) return;
		var key = String.fromCharCode(event.which).toLowerCase();
		switch (key) {
			case 'q':
				cleanup();
				alert('cleaned');
			case 's':
				setSaved();
		}
	});
});
