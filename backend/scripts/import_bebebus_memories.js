const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.resolve('d:/Devs/ArcRift/backend/ArcRift.db');
console.log('Opening database at:', dbPath);

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const spaceId = 'BeBeBus';
const now = new Date().toISOString();

// Ensure session exists
const session = db.prepare('SELECT id FROM sessions WHERE id = ?').get(spaceId);
if (!session) {
  db.prepare(`
    INSERT OR REPLACE INTO sessions (id, projectName, platform, tripleCount, topicCount, hasFullChat, tokensSaved, retrievalCount, createdAt, updatedAt)
    VALUES (?, ?, 'mcp', 0, 0, 0, 0, 0, ?, ?)
  `).run(spaceId, spaceId, now, now);
  console.log(`Created session for space: ${spaceId}`);
}

const memories = [
  {
    id: `mem_${uuidv4()}`,
    title: "【深度分析与修复】音频切歌与点播播放进度内存残留与即时归零机制",
    unit_type: "learning",
    importance: 0.95,
    labels: ["BeBeBus", "audio", "AudioAppStore", "playback-progress", "bugfix", "state-management", "architecture"],
    content: `# 【深度分析与修复】音频切歌与点播播放进度内存残留与即时归零机制

## 一、问题背景与现象描述
在音频合集/分集列表（AudioListActivity）中，用户点击不同的歌曲 item 进行切歌、点击播放列表浮层单曲、点击“全部播放”或者自动跳下一首时：
1. 底部的圆环进度条（playerProgressRing）以及悬浮播放器上的播放进度**不会立即归零**；
2. 进度条会直接显示上一首歌曲播放时停留的进度（例如 30%~50%），直到几百毫秒甚至数秒后收到硬件新的 MQTT 报文才会被纠正；
3. 如果切换到新歌曲后处于暂停状态，旧歌曲的进度还会一直挂在界面上，用户误以为本地持久化缓存了错误进度。

---

## 二、第一性原理与根本原因深度分析

### 1. 单例内存状态常驻未重置
AudioAppStore 是整个音频模块的全局单例（静态常驻内存），内部维护了：
* _playbackProgress = MutableStateFlow(0f)（播放进度百分比 0~100）
* lastMqttPosSec: Float = 0f（硬件绝对播放秒数锚点）
* lastMqttTimeMs: Long = 0L（收到报文时的本地流逝时间戳）

### 2. 状态变更链路漏掉清零逻辑
* 在 AudioAppStore.setPlaybackSession(list, index, cover) 和 updateCurrentIndex(index) 中：
  当外部通过列表点击切换曲目时，仅更新了 _currentIndex.value 和 currentStoryId，**完全没有将 _playbackProgress.value 和 lastMqttPosSec 重置为 0**！
* 在 AudioAppStore.updateFromMqttPlayStatus(info) 中：
  当硬件上报切到新歌曲（info.storyId != currentStoryId）时，同样没有在第一时间清空旧进度；
* **暂停状态保护误伤**：在 updateFromMqttPlayStatus 中存在如下保护代码：
  \`\`\`kotlin
  // 若暂停包中 positionTime == 0 且本地已有进度，不强制冲刷归零，保留当前停留进度
  if (!playing && info.positionTime == 0 && _playbackProgress.value > 0f) {
      return
  }
  \`\`\`
  切换到新曲目后若处于未播/暂停状态，由于 _playbackProgress.value 仍残留着上一首歌曲的进度（>0f），该保护逻辑误将上一首的旧进度当成了“当前曲目的已有进度”进行了保护，导致旧进度一直无法被冲刷。

---

## 三、完整修复方案与核心代码实现

### 1. AudioAppStore.kt 核心数据源改造
增加显式清零方法 resetPlaybackProgress()，并在所有曲目变更处强制触发清零：
\`\`\`kotlin
// AudioAppStore.kt

/** 显式将全局播放进度归零，清空上一首残留的锚点与进度百分比 */
fun resetPlaybackProgress() {
    _playbackProgress.value = 0f
    lastMqttPosSec = 0f
    lastMqttTimeMs = if (_isPlaying.value) SystemClock.elapsedRealtime() else 0L
}

fun setPlaybackSession(list: List<StoreInfo>, index: Int, collectionCover: String?) {
    cancelFinishDelayTask()
    _playlist.value = list.toList()
    val finalIndex = if (list.isEmpty()) 0 else index.coerceIn(0, list.lastIndex)
    _currentIndex.value = finalIndex
    collectionCoverUrl = collectionCover
    val newStory = list.getOrNull(finalIndex)
    val newStoryId = newStory?.id?.toLong() ?: -1L
    // 曲目 ID 发生变化时，立即重置进度为 0
    if (newStoryId != currentStoryId) {
        currentStoryId = newStoryId
        resetPlaybackProgress()
    }
    if (_isPlaying.value && lastMqttTimeMs == 0L) {
        lastMqttTimeMs = SystemClock.elapsedRealtime()
    }
}

fun updateCurrentIndex(index: Int) {
    cancelFinishDelayTask()
    val list = _playlist.value
    if (list.isEmpty()) return
    val finalIndex = index.coerceIn(0, list.lastIndex)
    val newStory = list.getOrNull(finalIndex)
    val newStoryId = newStory?.id?.toLong() ?: -1L
    // 下标或曲目 ID 变更时，立即重置进度为 0
    if (finalIndex != _currentIndex.value || newStoryId != currentStoryId) {
        _currentIndex.value = finalIndex
        currentStoryId = newStoryId
        resetPlaybackProgress()
    }
    if (_isPlaying.value && lastMqttTimeMs == 0L) {
        lastMqttTimeMs = SystemClock.elapsedRealtime()
    }
}

fun updateFromMqttPlayStatus(info: AudioPlayStatusInfo?) {
    if (info == null) return
    if (info.storyId > 0) {
        val newStoryId = info.storyId
        val targetIndex = _playlist.value.indexOfFirst { it.id.toLong() == newStoryId }
        // MQTT 收到切歌上报时，第一时间重置旧进度
        if (newStoryId != currentStoryId) {
            currentStoryId = newStoryId
            resetPlaybackProgress()
        }
        if (targetIndex >= 0) {
            if (targetIndex != _currentIndex.value) {
                _currentIndex.value = targetIndex
            }
        }
    }
}
\`\`\`

### 2. UI 点击交互即时清零响应 (AudioListActivity.kt)
在分集单曲点击（onEpisodeClick）、播放列表点击（onPlaylistItemClick）、全部播放（onPlayAllClick）、自动切歌（playNextAvailableEpisode）时显式调用：
\`\`\`kotlin
// AudioListActivity.kt
private fun onEpisodeClick(position: Int, episode: StoreInfo) {
    skippedCount = 0
    currentPlayingIndex = position
    mCurrentPlayingId = episode.id
    isPlayerPlaying = true
    // 1. 立即清空全局单例进度
    AudioAppStore.resetPlaybackProgress()
    recordPlaybackHistoryByIndex(position)
    AudioAppStore.setPlaybackSession(episodesOriginal, position, coverUrl)
    AudioAppStore.setPlaying(true)
    // 2. 立即重置悬浮窗圆环进度控件
    binding.floatingPlayer.setProgressPercent(0f)
    binding.floatingPlayer.syncFromAppStore()
    binding.floatingPlayer.startPlaybackFromCurrent()
    syncPlayStateUi()
    if (mCurrentPlayingId > 0) {
        mViewModel.playAudio(mCurrentPlayingId.toLong(), playType = playMode.toPlayType(), orderType = playMode.toOrderType())
    }
}
\`\`\`

---

## 四、验证结果与经验沉淀
1. **真机验证表现**：在播放进度处于 40% 的状态下点击列表中其他任意一首单曲，底部悬浮窗圆环进度与进度条瞬间清零（0%），新音频下发开播后从 0 平滑向前推进，彻底消除了进度残留 Bug。
2. **架构准则沉淀**：全局单例组件在承载跨页面/跨生命周期的状态时，一旦核心实体（ID / Session）切换，所有派生计算状态（进度、流逝时间戳、锚点）必须显式同步清空，绝不能依赖异步数据覆盖来被动修正。`
  },
  {
    id: `mem_${uuidv4()}`,
    title: "【深度分析与修复】专辑列表模式频繁切换导致数据骤降仅剩 2 首的页码残留 Bug",
    unit_type: "learning",
    importance: 0.95,
    labels: ["BeBeBus", "audio", "pagination", "AudioListViewModel", "concurrency", "bugfix", "data-integrity"],
    content: `# 【深度分析与修复】专辑列表模式频繁切换导致数据骤降仅剩 2 首的页码残留 Bug

## 一、问题背景与 Logcat 抓包证据

### 1. 现象描述
在包含 52 首歌曲的专辑（如《蜻蜓飞行队第二季》，ID: 509）详情页中：
1. 页面初始加载第 1 页（50 首）；
2. 用户滑动列表触底，触发上拉加载更多，加载出第 2 页（剩余 2 首，列表共 52 首）；
3. 此时用户频繁点击右上角的**播放模式切换按钮**（顺序 -> 倒序 -> 随机 -> 单曲循环）；
4. 列表中的歌曲数量突然从 52 首骤降为**仅剩最后 2 首**。

### 2. 核心 Logcat 日志抓包证据
\`\`\`log
19:04:55.234 D --> GET /bebebus-app/api/v2/story/storyList?parentId=509&orderType=1&playType=0&pageNum=2&pageSize=50
19:04:55.308 D <-- 200 ...
{
    "code": 1,
    "msg": "操作成功！",
    "orderType": 1,
    "rows": [
        { "id": 9704, "name": "去云南，协助大象迁徙之进击的大象" },
        { "id": 9703, "name": "出发长江寻找白鱀豚之洞庭湖风波" }
    ],
    "total": 52
}
19:04:55.464 D --> GET /bebebus-app/api/v2/story/storyList?parentId=509&orderType=0&playType=2&pageNum=2&pageSize=50
19:04:55.736 D --> GET /bebebus-app/api/v2/story/storyList?parentId=509&orderType=0&playType=1&pageNum=2&pageSize=50
\`\`\`
日志清晰表明：在模式切换时发出的 HTTP 请求竟然全部携带了 \`pageNum=2&pageSize=50\`！

---

## 二、根本原因深度分析

### 1. 状态残留：\`currentPage\` 未随刷新重置
* AudioListViewModel 内部维护了分页成员变量：
  \`\`\`kotlin
  private var currentPage = 1
  private val pageSize = 50
  private var isEnd = false
  private var isLoadingPage = false
  \`\`\`
* 当列表滑动到底部触发 loadMoreEpisodes() 时，currentPage 被累加到了 2。
* 当用户点击右上角切换播放模式时，触发了 AudioListViewModel.setOrderType()：
  \`\`\`kotlin
  // 缺陷代码
  fun setOrderType(newOrderType: Int) {
      val type = newOrderType.coerceIn(0, 3)
      val oldType = _orderType.value ?: 0
      if (oldType != type) {
          _orderType.value = type
          loadPage() // 默认 isRefresh = true
      }
  }
  \`\`\`
  **致命缺陷 1**：setOrderType() 触发刷新时**完全没有将 currentPage 重置为 1**！此时 currentPage 依然停留在 2。

### 2. 刷新逻辑与错误页码叠加导致列表被覆盖
* 在 loadPage(isRefresh = true) 内部：
  \`\`\`kotlin
  val currentList = if (isRefresh) emptyList() else (_episodes.value ?: emptyList())
  val updatedList = currentList + newRows
  _episodes.value = updatedList
  \`\`\`
  **致命缺陷 2**：因为 isRefresh = true，代码按刷新逻辑将 currentList 清空为 emptyList()，然后将带着 pageNum=2 请求返回的第 2 页数据（仅 2 首）赋值给了 _episodes.value，导致第 1 页的 50 首数据被直接冲掉，列表仅剩 2 首！

### 3. 频繁点击时的并发请求竞争
* 用户快速连续点击模式切换时，连续发出了多个带有不同 orderType/playType 的网络请求；
* 原代码未对上一次未完成的异步网络 Job 进行取消（cancel()），多个请求并发返回时发生乱序覆盖。

---

## 三、完整修复方案与代码实现

### 1. AudioListViewModel.kt 修复实现
在模式变更时强制重置分页状态，并引入 Job 级别的并发取消机制：
\`\`\`kotlin
// AudioListViewModel.kt

private var currentPage = 1
private val pageSize = 50
private var isEnd = false
private var isLoadingPage = false
private var loadPageJob: kotlinx.coroutines.Job? = null

fun setOrderType(newOrderType: Int) {
    val type = newOrderType.coerceIn(0, 3)
    val oldType = _orderType.value ?: 0
    if (oldType != type) {
        _orderType.value = type
        // 关键修复 1：模式发生变化时，必须强制重置页码为 1，并恢复 isEnd = false
        currentPage = 1
        isEnd = false
        loadPage(isRefresh = true)
    }
}

/** 下拉刷新：重新请求第一页数据 */
fun refreshEpisodes() {
    currentPage = 1
    isEnd = false
    loadPage(isRefresh = true)
}

/** 触底上拉：翻页加载下一页数据 */
fun loadMoreEpisodes() {
    if (isLoadingPage || isEnd) return
    currentPage++
    loadPage(isRefresh = false)
}

private fun loadPage(isRefresh: Boolean = true) {
    if (parentId <= 0) return
    // 关键修复 2：若是刷新模式，先取消上一次未完成的网络任务，防并发乱序
    if (isRefresh) {
        loadPageJob?.cancel()
        isLoadingPage = false
    } else if (isLoadingPage) {
        return
    }
    isLoadingPage = true
    if (isRefresh) {
        _loading.value = true
    }
    _error.value = null
    loadPageJob = viewModelScope.launch {
        val uiModeIndex = _orderType.value ?: 0
        val mode = PlayMode.fromOrderType(uiModeIndex)
        val result = repository.loadStoryDetails(
            parentId = parentId,
            deviceId = deviceId,
            orderType = mode.toOrderType(),
            playType = mode.toPlayType(),
            pageNum = currentPage,
            pageSize = pageSize
        )
        isLoadingPage = false
        if (result.isSuccess) {
            val response = result.getOrNull()
            val newRows = response?.rows.orEmpty()
            val total = response?.total ?: 0L
            _totalEpisodesCount.value = total.toInt()
            _isFavorite.value = (response?.isFavorite ?: 0) != 0

            val currentList = if (isRefresh) emptyList() else (_episodes.value ?: emptyList())
            val updatedList = currentList + newRows

            isEnd = updatedList.size >= total || newRows.isEmpty()
            _episodes.value = updatedList
        } else {
            _error.value = result.exceptionOrNull()?.message ?: "加载失败"
        }
        if (isRefresh) {
            _loading.value = false
        }
    }
}
\`\`\`

---

## 四、验证结果与经验沉淀
1. **真机测试验证**：列表滑到底部加载完第 2 页后，进行多次高频点击模式切换（连续点击 5~10 次），抓包显示每次均以 pageNum=1&pageSize=50 请求第 1 页，列表始终稳定展示第 1 页完整的 50 首数据，且支持继续滑动加载第 2 页，缩减问题彻底解决。
2. **分页架构准则沉淀**：
   * 任何具有“重置/刷新语义”的入口（如条件筛选、排序切换、模式变更、下拉刷新），必须将分页指针（currentPage）与分页结束标记（isEnd）原子级重置为初始态。
   * 发起刷新请求前必须显式取消当前未决的加载任务（Job.cancel()），避免并发数据竞争导致脏数据覆盖。`
  },
  {
    id: `mem_${uuidv4()}`,
    title: "【深度分析与修复】悬浮播放条点击事件向下穿透导致误跳转合集详情页 Bug",
    unit_type: "learning",
    importance: 0.90,
    labels: ["BeBeBus", "ui", "touch-events", "FloatingPlayerView", "BlurView", "bugfix", "event-dispatching"],
    content: `# 【深度分析与修复】悬浮播放条点击事件向下穿透导致误跳转合集详情页 Bug

## 一、问题背景与现象描述
在内容广场（ContentHubActivity）或收藏页（AudioCollectActivity）中，用户点击底部悬浮播放窗（FloatingPlayerView）的非功能按钮区域（例如：封面图片、单集标题文本、或悬浮条的背景空白处）时，页面意外发生了跳转，直接打开了被悬浮窗遮挡的底层故事合集详情页（AudioListActivity）。

---

## 二、Android 事件分发与层级第一性原理深度剖析

### 1. 布局层级结构
* activity_content_hub.xml 和 activity_audio_collect.xml 的根布局均为 FrameLayout；
* 悬浮播放条由 BlurView 承载毛玻璃背景，内部包裹 FloatingPlayerView，通过 android:layout_gravity="bottom" 覆盖在页面底部最上层；
* 悬浮播放条正下方是承载故事合集卡片的 RecyclerView / ViewPager2。

### 2. Touch 事件向下穿透（Touch-Through）机制
* 在 Android 的事件分发体系中：dispatchTouchEvent -> onInterceptTouchEvent -> onTouchEvent；
* 默认情况下，如果一个 View 及其子 View 的 isClickable 均为 false，且未设置 OnClickListener / OnTouchListener，该 View 在收到 ACTION_DOWN 时将返回 false（不消费事件）；
* 结果：事件会沿着 View 树向下传递给底层兄弟视图。
* **代码缺陷定位**：
  * 在 FloatingPlayerView 中，仅给 playerPrev、playerPlayPause、playerNext、playerMore 4 个 ImageButton 设置了 OnClickListener；
  * 而封面容器 playerCoverContainer、封面图 playerCover、标题文本 playerTitle、FloatingPlayerView 自身以及外层 BlurView 均未配置 isClickable = true；
  * 当用户手指点击悬浮条的封面、标题或空白处时，事件未被悬浮窗消费，直接穿透并命中了底层的 item_content_hub_card，触发了卡片的 onContentCardClick(item)，导致意外打开了 AudioListActivity。

---

## 三、完整修复方案与代码实现

### 1. FloatingPlayerView.kt 全域消费点击事件
在自定义 View 构造初始化时，为所有内部非功能子 View 及根 View 显式设置 isClickable = true、isFocusable = true 并消费点击：
\`\`\`kotlin
// FloatingPlayerView.kt

init {
    binding.playerTitle.ellipsize = android.text.TextUtils.TruncateAt.END
    binding.playerTitle.maxLines = 1
    binding.playerProgressRing.setProgress(0f)
    clipCoverToCircle()
    binding.playerPrev.setImageResource(R.mipmap.nic_audio_last)
    binding.playerNext.setImageResource(R.mipmap.nic_audio_next)
    binding.playerPlayPause.setImageResource(R.drawable.ic_audio_play)
    binding.playerMore.setImageResource(R.mipmap.nic_audio_list)
    applyPlayingUi(false)

    // 关键修复 1：悬浮条全域消费点击事件，彻底阻断点击穿透到底层列表卡片
    isClickable = true
    isFocusable = true
    binding.root.isClickable = true
    binding.playerCoverContainer.isClickable = true
    binding.playerCover.isClickable = true
    binding.playerTitle.isClickable = true
    
    binding.playerCoverContainer.setOnClickListener { /* 消费点击，禁止跳转 */ }
    binding.playerCover.setOnClickListener { /* 消费点击，禁止跳转 */ }
    binding.playerTitle.setOnClickListener { /* 消费点击，禁止跳转 */ }
    binding.root.setOnClickListener { /* 消费点击，禁止跳转 */ }

    // 仅保留明确的功能播控按钮监听
    binding.playerPlayPause.setOnClickListener {
        externalPlayPauseListener?.onClick(it)
    }
    binding.playerPrev.setOnClickListener {
        externalPrevListener?.onClick(it)
    }
    binding.playerNext.setOnClickListener {
        externalNextListener?.onClick(it)
    }
    binding.playerMore.setOnClickListener {
        externalMoreListener?.onClick(it)
    }
}
\`\`\`

### 2. 布局层防穿透屏障配置
在 activity_content_hub.xml 与 activity_audio_collect.xml 中的 BlurView 容器上显式配置 clickable 与 focusable：
\`\`\`xml
<!-- activity_content_hub.xml / activity_audio_collect.xml -->
<eightbitlab.com.blurview.BlurView
    android:id="@+id/blur_view"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_gravity="bottom"
    android:layout_marginHorizontal="@dimen/space_13"
    android:layout_marginBottom="50dp"
    android:background="@drawable/shape_gray_ccf4_28"
    android:clickable="true"
    android:elevation="@dimen/ele_button"
    android:focusable="true"
    android:visibility="gone">

    <com.bebebus.device.audiohub.ui.widget.FloatingPlayerView
        android:id="@+id/floating_player"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:background="@android:color/transparent"
        android:visibility="visible" />
</eightbitlab.com.blurview.BlurView>
\`\`\`

---

## 四、验证结果与经验沉淀
1. **真机测试验证**：在内容广场和收藏页中，多次连续点击悬浮窗的封面、标题文字及空白边缘区域，所有点击事件均被悬浮窗自身吞噬拦截，底层卡片无任何点击涟漪或响应，彻底杜绝了误跳转合集页的 Bug。
2. **UI 悬浮组件架构准则**：
   * 所有悬浮层、气泡弹窗、吸底播控条等置于顶层的 UI 组件，其根容器及各空白展示区域必须强制设置 clickable="true" 与 focusable="true"，构建事件分发防火墙，坚决防止底层视图被意外激活。`
  },
  {
    id: `mem_${uuidv4()}`,
    title: "【深度分析与修复】专辑详情页“全部播放”三态控制状态机与硬件播控协议修复",
    unit_type: "learning",
    importance: 0.98,
    labels: ["BeBeBus", "audio", "AudioListActivity", "state-machine", "play-control", "MQTT", "PlayOrSuspend", "architecture"],
    content: `# 【深度分析与修复】专辑详情页“全部播放”三态控制状态机与硬件播控协议修复

## 一、问题背景与用户诉求

### 1. 原始问题现象
在故事合集详情页（AudioListActivity）中，用户点击分集列表上方的“全部播放”按钮时无效果，既不能正常暂停正在播放的音频，也无法在暂停后恢复播放。

### 2. 目标交互状态机定义
1. **态 ①（播放中点击）**：当当前专辑正处于播放状态时，点击全部播放按钮 -> **暂停播放**，顶部图标切为播放态；
2. **态 ②（暂停态点击）**：当本专辑已有正在播放/选中的歌曲处于暂停态时，点击全部播放按钮 -> **继续断点播放当前曲目**（保持进度与曲目不重置），顶部图标切为暂停态；
3. **态 ③（首次进页点击）**：当首次进入本专辑（当前未在播放本专辑、无历史选集记录）时，点击全部播放按钮 -> **从第 1 首（Index 0）开始播放**，进度归零，顶部图标切为暂停态。

---

## 二、根本原因深度分析

### 1. 播控请求参数缺陷与接口混淆
* 原始 AudioListViewModel.pauseAudio() 内部调用了 repository.playOrSuspend(req: PlayAudioRequest)；
* 该接口下发的 JSON 请求体缺少了服务端判定播控动作的关键字段 flag（1 继续播放，2 暂停播放）；
* 服务端接收到缺少 flag 的请求后无法执行暂停动作，导致点击全部播放时无法暂停硬件设备。

### 2. 状态机缺失断点恢复逻辑
* 原 onPlayAllClick() 在非播放状态下，代码无条件执行：
  \`\`\`kotlin
  currentPlayingIndex = 0
  mCurrentPlayingId = episodesOriginal.getOrNull(0)?.id ?: -1
  AudioAppStore.setPlaybackSession(episodesOriginal, 0, coverUrl)
  mViewModel.playAudio(mCurrentPlayingId, positionTime = 0)
  \`\`\`
* 无论用户之前暂停在第几首、进度多少，只要点击全部播放就会被强制重置回第 0 首，无法实现“继续播放”的断点续播逻辑。

### 3. 顶部图标未打通全局 MQTT 播放状态
* 顶部全部播放图标（iv_play_all）仅在本地部分点击分支中刷新，当硬件通过 MQTT 异步上报 status=1 或 status=2 时，顶部图标未能实时联动。

---

## 三、完整修复方案与核心代码实现

### 1. AudioListActivity.kt 三态状态机重构
\`\`\`kotlin
// AudioListActivity.kt

private fun onPlayAllClick() {
    if (episodesOriginal.isEmpty()) {
        showToast("正在加载分集列表，请稍候")
        return
    }

    val activePlayingId = AudioAppStore.getCurrentPlayingStoryId()
    val isCurrentCollectionInSession = episodesOriginal.any { it.id == activePlayingId }

    if (isPlayerPlaying && activePlayingId > 0 && isCurrentCollectionInSession) {
        // 态 ①：当前正在播放本专辑歌曲 -> 暂停播放
        val targetId = if (mCurrentPlayingId > 0) mCurrentPlayingId.toLong() else activePlayingId.toLong()
        isPlayerPlaying = false
        AudioAppStore.setPlaying(false)
        binding.floatingPlayer.syncFromAppStore()
        syncPlayStateUi()
        if (targetId > 0) {
            mViewModel.playOrSuspend(targetId, flag = 2)
        }
    } else if (currentPlayingIndex >= 0 || (activePlayingId > 0 && isCurrentCollectionInSession)) {
        // 态 ②：当前处于暂停状态，但本专辑已有选中古事/上一首播放记录 -> 断点继续播放
        val resumeIndex = if (currentPlayingIndex >= 0) {
            currentPlayingIndex
        } else {
            episodesOriginal.indexOfFirst { it.id == activePlayingId }.coerceAtLeast(0)
        }
        val resumeEpisode = episodesOriginal.getOrNull(resumeIndex) ?: episodesOriginal[0]
        currentPlayingIndex = resumeIndex
        mCurrentPlayingId = resumeEpisode.id
        isPlayerPlaying = true
        AudioAppStore.setPlaybackSession(episodesOriginal, resumeIndex, coverUrl)
        AudioAppStore.setPlaying(true)
        binding.floatingPlayer.syncFromAppStore()
        syncPlayStateUi()
        mViewModel.playOrSuspend(resumeEpisode.id.toLong(), flag = 1)
    } else {
        // 态 ③：首次进入本专辑（无任何本专辑播放记录） -> 从第 1 首歌（Index 0）开始播放
        skippedCount = 0
        currentPlayingIndex = 0
        mCurrentPlayingId = episodesOriginal[0].id
        isPlayerPlaying = true
        AudioAppStore.resetPlaybackProgress()
        recordPlaybackHistoryByIndex(0)
        AudioAppStore.setPlaybackSession(episodesOriginal, 0, coverUrl)
        AudioAppStore.setPlaying(true)
        binding.floatingPlayer.setProgressPercent(0f)
        binding.floatingPlayer.syncFromAppStore()
        binding.floatingPlayer.startPlaybackFromCurrent()
        syncPlayStateUi()
        mViewModel.playAudio(
            mCurrentPlayingId.toLong(),
            playType = playMode.toPlayType(),
            orderType = playMode.toOrderType(),
            positionTime = 0
        )
    }
}

/** 统一同步主列表、浮层列表、悬浮播放器与顶部全部播放按钮的状态 */
private fun syncPlayStateUi() {
    refreshEpisodeHighlight(submitListData = false)
    refreshPlaylistIfVisible()
    val activePlayingId = AudioAppStore.getCurrentPlayingStoryId()
    val isCurrentCollectionPlaying = isPlayerPlaying &&
            activePlayingId > 0 &&
            episodesOriginal.any { it.id == activePlayingId }

    binding.ivPlayAll.setImageResource(
        if (isCurrentCollectionPlaying) BaseR.mipmap.nic_audio_pause else BaseR.mipmap.nic_audio_play
    )
}
\`\`\`

### 2. AudioListViewModel.kt 播控协议规范化
统一使用支持 flag 与 positionTime 的 playOrSuspendAudio 接口：
\`\`\`kotlin
// AudioListViewModel.kt

fun playOrSuspend(storyId: Long, flag: Int, positionTime: Int = AudioAppStore.getCurrentPositionSec()) {
    if (deviceId.isEmpty() || storyId <= 0) return
    val actionText = if (flag == 1) "继续播放" else if (flag == 2) "暂停播放" else "播放控制"
    LogUtil.aiI("AudioApi", "下发\${actionText}指令: POST /bebebus-app/api/v2/audio/playOrSuspend, deviceId=$deviceId, storyId=$storyId, flag=$flag, positionTime=$positionTime")
    viewModelScope.launch {
        val req = PlayOrSuspendRequest(deviceId = deviceId, storyId = storyId, flag = flag, positionTime = positionTime)
        val result = repository.playOrSuspendAudio(req)
        LogUtil.aiI("AudioApi", "\${actionText}指令下发结果: isSuccess=\${result.isSuccess}")
        if (result.isSuccess) {
            AudioAppStore.setPlaying(flag == 1)
        } else {
            _error.value = result.exceptionOrNull()?.message ?: "\${actionText}指令发送失败"
        }
    }
}
\`\`\`

---

## 四、Logcat 真实时序验证数据

\`\`\`log
// 1. 首次进入专辑 508，点击全部播放：从第 1 首 6383 开播
08:13:42.625 I [AudioApi] 下发硬件播放指令: POST /bebebus-app/api/v2/audio/play, deviceId=2086639333896294401, mediaId=6383, playType=2, orderType=0
08:13:43.312 D <-- 200 {"code":1,"data":1477,"msg":"播放成功!"}
08:13:45.565 D [AiMqttClient] 收到音频状态 (status=1, pos=0, storyId=6383) -> 硬件开播成功

// 2. 切歌至 6388，播放到第 5 秒时点击全部播放：触发暂停
08:13:59.675 I [AudioApi] 下发暂停播放指令: POST /bebebus-app/api/v2/audio/playOrSuspend, deviceId=2086639333896294401, storyId=6388, flag=2, positionTime=5
08:13:59.745 D <-- 200 {"code":1,"msg":"操作成功!"}
08:14:00.097 D [AiMqttClient] 收到音频状态 (status=2, pos=5, storyId=6388) -> 硬件精准第 5 秒暂停成功

// 3. 暂停态下再次点击全部播放：断点继续播放 6388
08:14:02.286 I [AudioApi] 下发继续播放指令: POST /bebebus-app/api/v2/audio/playOrSuspend, deviceId=2086639333896294401, storyId=6388, flag=1, positionTime=5
08:14:02.367 D <-- 200 {"code":1,"msg":"操作成功!"}
08:14:02.757 D [AiMqttClient] 收到音频状态 (status=1, pos=5, storyId=6388) -> 硬件精准第 5 秒恢复播放成功

// 4. 再次点击全部播放：再次成功暂停
08:14:04.416 I [AudioApi] 下发暂停播放指令: POST /bebebus-app/api/v2/audio/playOrSuspend, deviceId=2086639333896294401, storyId=6388, flag=2, positionTime=6
08:14:04.495 D <-- 200 {"code":1,"msg":"操作成功!"}
08:14:04.798 D [AiMqttClient] 收到音频状态 (status=2, pos=8, storyId=6388) -> 硬件成功暂停
\`\`\`

---

## 五、验证结论与经验沉淀
1. **验证结论**：全部播放按钮的三态控制（开播/暂停/继续）100% 闭环，端到端与硬件 MQTT 毫秒级同步。
2. **播控状态机设计准则**：
   * 列表/合集级别的“全部播放”按钮，绝不能简单绑定为“播放全部”，必须具备**播放态（Pause）、暂停态（Resume）、初始态（Play First）**三态感知能力；
   * 断点续播时必须精确携带当前暂停点 positionTime 和 flag=1，确保硬件无缝继续，提供最丝滑的用户听书体验。`
  }
];

const insertStmt = db.prepare(`
  INSERT INTO memories (
    id, sessionId, title, content, importance, category, unit_type,
    labels, tags, claim_status, evolves_from_id, evolves_relation,
    is_latest, source, source_app, temporal_context, createdAt, updatedAt
  ) VALUES (?, ?, ?, ?, ?, 'Learning', ?, ?, ?, 'asserted', NULL, NULL, 1, 'mcp', 'ChronosMind', 'timeless', ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title,
    content = excluded.content,
    importance = excluded.importance,
    unit_type = excluded.unit_type,
    labels = excluded.labels,
    tags = excluded.tags,
    updatedAt = excluded.updatedAt
`);

const ftsStmt = db.prepare(`
  INSERT INTO fts_memories (memory_id, title, content, labels)
  VALUES (?, ?, ?, ?)
`);

const results = [];

for (const mem of memories) {
  const labelsJson = JSON.stringify(mem.labels);
  insertStmt.run(
    mem.id,
    spaceId,
    mem.title,
    mem.content,
    mem.importance,
    mem.unit_type,
    labelsJson,
    labelsJson,
    now,
    now
  );

  try {
    db.prepare('DELETE FROM fts_memories WHERE memory_id = ?').run(mem.id);
    ftsStmt.run(mem.id, mem.title, mem.content, mem.labels.join(' '));
  } catch (e) {
    console.warn('FTS insert warning:', e.message);
  }

  results.push({
    id: mem.id,
    title: mem.title,
    unit_type: mem.unit_type,
    importance: mem.importance,
    labels: mem.labels
  });
  console.log(`Stored memory: [${mem.id}] ${mem.title}`);
}

// Update Working Memory
const briefing = `BeBeBus 音频播放与列表控制模块深度优化与 Bug 修复完成。已归档 4 篇重大深度技术分析与修复记录：
1. 音频切歌与点播播放进度内存残留与即时归零机制；
2. 专辑列表模式频繁切换导致数据骤降仅剩 2 首的页码残留 Bug 修复；
3. 悬浮播放条点击事件向下穿透导致误跳转合集详情页修复；
4. 专辑详情页“全部播放”三态控制状态机与硬件播控协议闭环。`;

const focusAreas = [
  "BeBeBus 音频播放器全链路状态管理与性能监控",
  "MQTT 硬件播控双向同步时序稳定性保障",
  "分页加载与多并发网络请求防护"
];

const activeDecisions = [
  "全局单例（AudioAppStore）跨曲目/会话切换时，所有派生计算状态（进度、流逝时间戳、锚点）必须显式同步清空，不能被动依赖异步数据覆盖",
  "所有具有刷新语义的入口（模式切换、筛选、下拉刷新）必须原子级重置 currentPage=1 与 isEnd=false，并显式 cancel 上一次未决异步 Job",
  "悬浮播放组件（FloatingPlayerView）及毛玻璃背景容器必须全域拦截消费 Touch 事件（clickable=true, focusable=true），构建事件分发防火墙",
  "全部播放按钮重构为标准三态状态机（播放态=暂停、暂停态=断点继续、初始态=首曲开播），并携带 flag 与 positionTime 与硬件 MQTT 保持毫秒级同步"
];

const blockers = [
  "无阻塞问题；音频模块 4 大核心缺陷已全部真机 Logcat / MQTT 验证闭环"
];

db.prepare(`
  INSERT INTO working_memory (sessionId, briefing, focusAreas, activeDecisions, blockers, lastGeneratedAt, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(sessionId) DO UPDATE SET
    briefing = excluded.briefing,
    focusAreas = excluded.focusAreas,
    activeDecisions = excluded.activeDecisions,
    blockers = excluded.blockers,
    lastGeneratedAt = excluded.lastGeneratedAt,
    updatedAt = excluded.updatedAt
`).run(
  spaceId,
  briefing,
  JSON.stringify(focusAreas),
  JSON.stringify(activeDecisions),
  JSON.stringify(blockers),
  now,
  now
);

console.log('Successfully updated Working Memory for space:', spaceId);
console.log(JSON.stringify(results, null, 2));
