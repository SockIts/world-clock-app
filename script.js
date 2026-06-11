// Store the clocks that are currently displayed
let activeClocks = [
    { timezone: 'America/New_York', name: 'New York' },
    { timezone: 'Europe/London', name: 'London' },
    { timezone: 'Asia/Tokyo', name: 'Tokyo' },
    { timezone: 'Australia/Sydney', name: 'Sydney' }
];

let use24HourClock = localStorage.getItem('use24HourClock') !== 'false';
let selectedConverterIndex = Number(localStorage.getItem('selectedConverterIndex') || 8);
let selectedConverterDate = localStorage.getItem('selectedConverterDate') || getDateKey(new Date());
const localTodayKey = getDateKey(new Date());
const legacyUtcTodayKey = new Date().toISOString().slice(0, 10);
if (
    !localStorage.getItem('convertedLocalTimeReference')
    && selectedConverterDate === legacyUtcTodayKey
    && selectedConverterDate !== localTodayKey
) {
    selectedConverterDate = localTodayKey;
    localStorage.setItem('selectedConverterDate', selectedConverterDate);
    localStorage.setItem('convertedLocalTimeReference', 'true');
}
let draggedClockTimezone = null;
let savedEvents = JSON.parse(localStorage.getItem('savedEvents') || '[]');

// Emoji map for regions
const regionEmojis = {
    'America': '🌎',
    'Europe': '🌍',
    'Asia': '🌏',
    'Australia': '🌏',
    'Pacific': '🌏',
    'Africa': '🌍'
};

const weatherByRegion = {
    'America': '🌤️',
    'Europe': '☁️',
    'Asia': '☀️',
    'Australia': '🌤️',
    'Pacific': '🌦️',
    'Africa': '☀️'
};

// Get region from timezone
function getRegionFromTimezone(timezone) {
    const region = timezone.split('/')[0];
    return regionEmojis[region] || '🌐';
}

function getWeatherFromTimezone(timezone) {
    const region = timezone.split('/')[0];
    return weatherByRegion[region] || '🌤️';
}

function getUtcOffsetLabel(timezone) {
    try {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            timeZoneName: 'shortOffset'
        }).formatToParts(new Date());
        const offset = parts.find(part => part.type === 'timeZoneName')?.value || '';
        return offset.replace('GMT', 'UTC').replace('UTC+0', 'UTC').replace('UTC-0', 'UTC');
    } catch {
        return 'UTC';
    }
}

function labelTimezoneOptions() {
    document.querySelectorAll('#timezoneSelect option[value]').forEach(option => {
        if (!option.value) return;
        if (!option.dataset.cityName) option.dataset.cityName = option.textContent.trim();
        option.textContent = `${option.dataset.cityName} (${getUtcOffsetLabel(option.value)})`;
    });
}

function getCountryFromTimezone(timezone) {
    const countries = {
        'America/New_York': 'United States',
        'America/Chicago': 'United States',
        'America/Denver': 'United States',
        'America/Los_Angeles': 'United States',
        'America/Toronto': 'Canada',
        'America/Vancouver': 'Canada',
        'America/Mexico_City': 'Mexico',
        'Europe/London': 'United Kingdom',
        'Europe/Paris': 'France',
        'Europe/Berlin': 'Germany',
        'Europe/Rome': 'Italy',
        'Europe/Madrid': 'Spain',
        'Europe/Moscow': 'Russia',
        'Asia/Tokyo': 'Japan',
        'Asia/Shanghai': 'China',
        'Asia/Hong_Kong': 'Hong Kong',
        'Asia/Singapore': 'Singapore',
        'Asia/Dubai': 'United Arab Emirates',
        'Asia/Kolkata': 'India',
        'Asia/Seoul': 'South Korea',
        'Australia/Sydney': 'Australia',
        'Australia/Melbourne': 'Australia',
        'Pacific/Auckland': 'New Zealand',
        'America/Sao_Paulo': 'Brazil',
        'America/Buenos_Aires': 'Argentina',
        'America/Santiago': 'Chile',
        'Africa/Cairo': 'Egypt',
        'Africa/Johannesburg': 'South Africa',
        'Africa/Lagos': 'Nigeria'
    };

    return countries[timezone] || timezone.split('/')[0];
}

function sortActiveClocks() {
    activeClocks.sort((a, b) => Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)));
}

function normalizeSingleFavorite() {
    let favoriteFound = false;
    activeClocks.forEach(clock => {
        if (!clock.favorite) return;
        if (favoriteFound) {
            clock.favorite = false;
            return;
        }
        favoriteFound = true;
    });
}

function renderClockCards() {
    sortActiveClocks();
    const container = document.getElementById('clocksContainer');
    if (!container) return;
    container.innerHTML = '';
    activeClocks.forEach(clock => {
        container.appendChild(createClockElement(clock.timezone, clock.name, {
            customLabel: clock.customLabel,
            favorite: clock.favorite
        }));
    });
    updateClocks();
    updateWorldMapMarkers();
    populateEventTimezoneOptions();
    renderEventPreview();
}

function moveClockBefore(dragTimezone, dropTimezone) {
    if (!dragTimezone || !dropTimezone || dragTimezone === dropTimezone) return;

    const dragIndex = activeClocks.findIndex(clock => clock.timezone === dragTimezone);
    const dropIndex = activeClocks.findIndex(clock => clock.timezone === dropTimezone);
    if (dragIndex === -1 || dropIndex === -1) return;

    const draggedClock = activeClocks[dragIndex];
    const targetClock = activeClocks[dropIndex];

    // Favorites stay in the favorite group; regular clocks stay in the regular group.
    if (Boolean(draggedClock.favorite) !== Boolean(targetClock.favorite)) return;

    activeClocks.splice(dragIndex, 1);
    const adjustedDropIndex = activeClocks.findIndex(clock => clock.timezone === dropTimezone);
    activeClocks.splice(adjustedDropIndex, 0, draggedClock);
    saveClockPreferences();
    renderClockCards();
}

function handleClockDragStart(event) {
    const card = event.currentTarget;
    draggedClockTimezone = card.dataset.timezone;
    card.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', draggedClockTimezone);
}

function handleClockDragOver(event) {
    event.preventDefault();
    const card = event.currentTarget;
    if (!draggedClockTimezone || card.dataset.timezone === draggedClockTimezone) return;
    card.classList.add('drag-over');
    event.dataTransfer.dropEffect = 'move';
}

function handleClockDragLeave(event) {
    event.currentTarget.classList.remove('drag-over');
}

function handleClockDrop(event) {
    event.preventDefault();
    const card = event.currentTarget;
    card.classList.remove('drag-over');
    moveClockBefore(draggedClockTimezone || event.dataTransfer.getData('text/plain'), card.dataset.timezone);
}

function handleClockDragEnd() {
    draggedClockTimezone = null;
    document.querySelectorAll('.clock.dragging, .clock.drag-over').forEach(card => {
        card.classList.remove('dragging', 'drag-over');
    });
}

function isNightBackgroundTime(timezone) {
    const hour = Number(new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        hourCycle: 'h23'
    }).format(new Date()));

    return hour >= 0 && hour < 7;
}

// Function to create a clock element with more details and analog clock
function createClockElement(timezone, cityName, options = {}) {
    const clockDiv = document.createElement('div');
    clockDiv.className = 'clock';
    clockDiv.dataset.timezone = timezone;
    clockDiv.dataset.customLabel = options.customLabel ? 'true' : 'false';
    clockDiv.draggable = true;
    clockDiv.addEventListener('dragstart', handleClockDragStart);
    clockDiv.addEventListener('dragover', handleClockDragOver);
    clockDiv.addEventListener('dragleave', handleClockDragLeave);
    clockDiv.addEventListener('drop', handleClockDrop);
    clockDiv.addEventListener('dragend', handleClockDragEnd);

    const utilityBtn = document.createElement('button');
    utilityBtn.className = 'clock-utility';
    utilityBtn.innerHTML = '<i class="fas fa-arrows-alt"></i>';
    utilityBtn.title = 'Clock controls';
    clockDiv.appendChild(utilityBtn);

    const formatToggle = document.createElement('div');
    formatToggle.className = 'format-toggle';
    formatToggle.innerHTML = `
        <button class="format-btn ${use24HourClock ? '' : 'active'}" data-format="12">12h</button>
        <button class="format-btn ${use24HourClock ? 'active' : ''}" data-format="24">24h</button>
    `;
    formatToggle.addEventListener('click', (event) => {
        const button = event.target.closest('.format-btn');
        if (!button) return;
        use24HourClock = button.dataset.format === '24';
        localStorage.setItem('use24HourClock', use24HourClock);
        document.querySelectorAll('.format-btn').forEach(btn => {
            btn.classList.toggle('active', (btn.dataset.format === '24') === use24HourClock);
        });
        updateClocks();
    });
    clockDiv.appendChild(formatToggle);

    // Add background icon element
    const bgIcon = document.createElement('div');
    bgIcon.className = 'clock-background';
    bgIcon.innerHTML = getRegionFromTimezone(timezone);
    clockDiv.appendChild(bgIcon);

    // Create city heading with flag/region emoji
    const cityDiv = document.createElement('div');
    cityDiv.className = 'city';
    cityDiv.innerHTML = options.customLabel
        ? cityName.replace(/\/.*$/, '')
        : `${cityName.replace(/\/.*$/, '')},<br>${getCountryFromTimezone(timezone)}`;
    clockDiv.appendChild(cityDiv);

    // Add timezone info
    const timezoneDiv = document.createElement('div');
    timezoneDiv.className = 'timezone';
    timezoneDiv.textContent = timezone.replace('_', ' ');
    clockDiv.appendChild(timezoneDiv);

    // Add digital time and date display
    const timeDiv = document.createElement('div');
    timeDiv.className = 'time';
    clockDiv.appendChild(timeDiv);

    const dateDiv = document.createElement('div');
    dateDiv.className = 'date';
    clockDiv.appendChild(dateDiv);

    const metaRow = document.createElement('div');
    metaRow.className = 'clock-meta-row';
    clockDiv.appendChild(metaRow);

    const ghostTimeDiv = document.createElement('div');
    ghostTimeDiv.className = 'ghost-time';
    clockDiv.appendChild(ghostTimeDiv);

    const sunInfo = document.createElement('div');
    sunInfo.className = 'sun-info';
    sunInfo.innerHTML = 'Sun Time: 10h 06m<br>07:12 - 17:17';
    clockDiv.appendChild(sunInfo);

    // Create analog clock
    const analogClock = document.createElement('div');
    analogClock.className = 'analog-clock';

    // Add clock markers (hour marks)
    for (let i = 1; i <= 12; i++) {
        const marker = document.createElement('div');
        marker.className = i % 3 === 0 ? 'clock-marker main' : 'clock-marker';
        analogClock.appendChild(marker);
    }

    // Add clock hands
    const hourHand = document.createElement('div');
    hourHand.className = 'hour-hand';

    const minuteHand = document.createElement('div');
    minuteHand.className = 'minute-hand';

    const secondHand = document.createElement('div');
    secondHand.className = 'second-hand';

    const clockCenter = document.createElement('div');
    clockCenter.className = 'clock-center';

    analogClock.appendChild(hourHand);
    analogClock.appendChild(minuteHand);
    analogClock.appendChild(secondHand);
    analogClock.appendChild(clockCenter);

    // Add time difference indicator
    const clockFooter = document.createElement('div');
    clockFooter.className = 'clock-footer';

    const timeDifference = document.createElement('div');
    timeDifference.className = 'time-difference';
    clockFooter.appendChild(timeDifference);

    // Add clock actions
    const clockActions = document.createElement('div');
    clockActions.className = 'clock-actions';

    const favoriteBtn = document.createElement('button');
    favoriteBtn.className = 'btn-icon';
    favoriteBtn.innerHTML = `<i class="${options.favorite ? 'fas' : 'far'} fa-star"></i>`;
    favoriteBtn.title = options.favorite ? 'Remove from favorites' : 'Add to favorites';
    if (options.favorite) favoriteBtn.querySelector('i').style.color = '#f6ad55';
    favoriteBtn.addEventListener('click', () => {
        const clock = activeClocks.find(item => item.timezone === timezone);
        if (!clock) return;
        const shouldFavorite = !clock.favorite;
        activeClocks.forEach(item => {
            item.favorite = false;
        });
        clock.favorite = shouldFavorite;
        saveClockPreferences();
        renderClockCards();
    });
    clockActions.appendChild(favoriteBtn);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-icon';
    removeBtn.innerHTML = '<i class="fas fa-times"></i>';
    removeBtn.title = 'Remove clock';
    removeBtn.addEventListener('click', () => {
        // Update app state and map pins immediately. Waiting for the card animation
        // caused the marker layer to briefly desync and appear empty until refresh.
        activeClocks = activeClocks.filter(clock => clock.timezone !== timezone);
        saveClockPreferences();
        updateWorldMapMarkers();

        clockDiv.style.animation = 'fadeIn 0.5s ease-out reverse forwards';
        setTimeout(() => {
            renderClockCards();
        }, 500);
    });
    clockActions.appendChild(removeBtn);

    const mapBtn = document.createElement('button');
    mapBtn.className = 'btn-icon map-focus-btn';
    mapBtn.innerHTML = '<i class="fas fa-bullseye"></i>';
    mapBtn.title = 'Focus on map pin';
    mapBtn.addEventListener('click', () => focusMapOnTimezone(timezone));
    clockActions.appendChild(mapBtn);

    clockFooter.appendChild(clockActions);

    // Add all elements to the clock div
    clockDiv.appendChild(analogClock);
    clockDiv.appendChild(clockFooter);

    return clockDiv;
}

// Calculate time difference between local time and another timezone
function calculateTimeDifference(timezone) {
    const localTime = new Date();
    const localOffset = localTime.getTimezoneOffset() * 60000;
    const targetTime = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));

    // Get UTC timestamps and calculate difference in hours
    const utcLocal = localTime.getTime() + localOffset;
    const utcTarget = targetTime.getTime() + localOffset;
    const diffHours = Math.round((utcTarget - utcLocal) / 3600000);

    if (diffHours === 0) {
        return 'Same time as local';
    } else if (diffHours > 0) {
        return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ahead`;
    } else {
        return `${Math.abs(diffHours)} hour${Math.abs(diffHours) !== 1 ? 's' : ''} behind`;
    }
}

// Update all clocks
function ensureFlipClockMarkup(timeElement, periodDisplay) {
    if (!timeElement.querySelector('.flip-clock.hour')) {
        timeElement.innerHTML = `
            <span class="flip-period"></span>
            <span class="flip-clock down hour"><span class="digital front"></span><span class="digital back"></span></span>
            <span class="flip-clock down minute"><span class="digital front"></span><span class="digital back"></span></span>
        `;
    }

    timeElement.querySelector('.flip-period').textContent = periodDisplay || (use24HourClock ? '24H' : '');
}

function flipClockUnit(unitElement, nextValue) {
    const formattedNumber = String(nextValue).padStart(2, '0');
    const front = unitElement.querySelector('.front');
    const back = unitElement.querySelector('.back');
    const currentNumber = front.dataset.number;

    if (!currentNumber) {
        front.dataset.number = formattedNumber;
        back.dataset.number = formattedNumber;
        return;
    }

    if (currentNumber === formattedNumber || unitElement.classList.contains('go')) return;

    back.dataset.number = formattedNumber;
    unitElement.classList.add('go');

    setTimeout(() => {
        unitElement.classList.remove('go');
        front.dataset.number = formattedNumber;
    }, 600);
}

function timePartsForZone(timezone, date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: use24HourClock ? 'h23' : 'h12'
    }).formatToParts(date);

    return {
        hour: parts.find(part => part.type === 'hour')?.value || '00',
        minute: parts.find(part => part.type === 'minute')?.value || '00',
        period: parts.find(part => part.type === 'dayPeriod')?.value || ''
    };
}

function getZonedHour(timezone, date) {
    return Number(new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        hourCycle: 'h23'
    }).format(date));
}

function getTimePhase(hour) {
    if (hour >= 22 || hour <= 5) return 'night';
    if ((hour >= 6 && hour <= 7) || (hour >= 19 && hour <= 21)) return 'twilight';
    return 'day';
}

function getEventColumnRange(event, dayStart) {
    const eventStart = new Date(event.startIso);
    const eventEnd = new Date(eventStart.getTime() + Number(event.durationMinutes) * 60 * 1000);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const clampedStart = new Date(Math.max(eventStart.getTime(), dayStart.getTime()));
    const clampedEnd = new Date(Math.min(eventEnd.getTime(), dayEnd.getTime()));
    if (clampedEnd <= dayStart || clampedStart >= dayEnd) return null;

    return {
        start: Math.max(0, Math.floor((clampedStart - dayStart) / 3600000)),
        end: Math.min(24, Math.ceil((clampedEnd - dayStart) / 3600000)),
        preciseStart: ((clampedStart - dayStart) / 3600000),
        event
    };
}

function renderConverterNotes(dayStart, nowIndex) {
    const eventRanges = savedEvents
        .map(event => getEventColumnRange(event, dayStart))
        .filter(Boolean)
        .sort((a, b) => a.preciseStart - b.preciseStart);

    const rows = [];
    if (nowIndex >= 0) rows.push(`<span class="converter-now-note" style="--note-index:${nowIndex}">Current time</span>`);
    eventRanges.forEach((range, index) => {
        const lane = rows.length;
        rows.push(`<span class="converter-event-note" style="--note-index:${range.start}; --note-width:${Math.max(1, range.end - range.start)}; --note-lane:${lane}">${range.event.name}</span>`);
    });

    const noteLines = Math.max(1, rows.length);
    const eventMarkers = eventRanges.map((range, index) => `
        <div class="converter-event-marker" style="--event-index:${range.start}; --event-width:${Math.max(1, range.end - range.start)}; --note-lines:${noteLines}"></div>
    `).join('');

    return `${eventMarkers}
        <div class="converter-note-row" style="--note-lines:${noteLines}">
            <div class="converter-note-spacer"></div>
            <div class="converter-note-track">${rows.join('')}</div>
        </div>
    `;
}

function getDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getZonedDateKey(timezone, date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date).reduce((acc, part) => {
        acc[part.type] = part.value;
        return acc;
    }, {});

    return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatConverterDayLabel(date, options = {}) {
    return new Intl.DateTimeFormat('en-US', {
        weekday: options.short ? 'short' : 'long',
        month: 'short',
        day: 'numeric'
    }).format(date);
}

function formatZonedDayLabel(timezone, date) {
    return new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    }).format(date);
}

function getConverterSelectedDate() {
    const [year, month, day] = selectedConverterDate.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
}

function shiftDate(date, days) {
    const shifted = new Date(date);
    shifted.setDate(shifted.getDate() + days);
    return shifted;
}

function renderTimeConverter() {
    const grid = document.getElementById('converterGrid');
    const range = document.getElementById('converterRange');
    if (!grid || !range) return;

    const now = new Date();
    const selectedDay = getConverterSelectedDate();
    const selectedKey = getDateKey(selectedDay);
    const todayKey = getDateKey(now);
    const dayStart = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate(), 0, 0, 0);
    const offsets = Array.from({ length: 24 }, (_, index) => index);
    const calendarDays = Array.from({ length: 7 }, (_, index) => {
        const day = shiftDate(selectedDay, index - 3);
        const dayKey = getDateKey(day);
        const label = dayKey === todayKey
            ? 'Today'
            : new Intl.DateTimeFormat('en-US', { weekday: 'short', day: 'numeric' }).format(day);
        const isSelected = dayKey === selectedKey;
        const isWeekend = day.getDay() === 0 || day.getDay() === 6;
        return `<button type="button" class="calendar-day ${isSelected ? 'active' : ''} ${isWeekend ? 'weekend' : ''}" data-date="${dayKey}">${label}</button>`;
    }).join('');

    range.innerHTML = `<span class="calendar-icon">▦</span>${calendarDays}`;
    range.querySelectorAll('.calendar-day').forEach(button => {
        button.addEventListener('click', () => {
            selectedConverterDate = button.dataset.date;
            localStorage.setItem('selectedConverterDate', selectedConverterDate);
            renderTimeConverter();
        });
    });

    const nowIndex = selectedKey === todayKey ? now.getHours() : -1;
    grid.style.setProperty('--current-index', Math.max(nowIndex, 0));
    grid.classList.toggle('has-current-time', nowIndex >= 0);
    const currentMarker = nowIndex >= 0 ? '<div class="converter-current-marker"></div>' : '';
    const dayHeader = `
        <div class="converter-day-header" aria-label="Selected converter day">
            <div class="converter-day-spacer">Day</div>
            <div class="converter-day-track">
                <span>${formatConverterDayLabel(dayStart)}</span>
            </div>
        </div>
    `;

    grid.innerHTML = currentMarker + dayHeader + activeClocks.map(clock => {
        const current = timePartsForZone(clock.timezone, now);
        const dayLabel = new Intl.DateTimeFormat('en-US', {
            timeZone: clock.timezone,
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        }).format(now);
        const cells = offsets.map((offset, index) => {
            const point = new Date(dayStart.getTime() + offset * 60 * 60 * 1000);
            const previousPoint = index > 0 ? new Date(dayStart.getTime() + (offset - 1) * 60 * 60 * 1000) : null;
            const hour = getZonedHour(clock.timezone, point);
            const previousHour = previousPoint ? getZonedHour(clock.timezone, previousPoint) : null;
            const crossesIntoNewDay = previousPoint
                && previousHour === 23
                && hour === 0
                && getZonedDateKey(clock.timezone, previousPoint) !== getZonedDateKey(clock.timezone, point);
            const phase = getTimePhase(hour);
            const isNow = index === nowIndex;
            const label = hour % 12 || 12;
            const ampm = hour < 12 ? 'am' : 'pm';
            const midnightLabel = crossesIntoNewDay
                ? `<span class="converter-midnight-label">${formatZonedDayLabel(clock.timezone, point)}</span>`
                : '';
            return `<button class="converter-hour ${phase} ${isNow ? 'now' : ''} ${crossesIntoNewDay ? 'day-break' : ''}" data-hour-index="${index}" type="button" aria-label="${label}${ampm}${crossesIntoNewDay ? `, ${formatZonedDayLabel(clock.timezone, point)}` : ''}${isNow ? ', current time' : ''}">${midnightLabel}<b>${label}</b><small>${ampm}</small></button>`;
        }).join('');

        return `
            <article class="converter-row">
                <div class="converter-city">
                    <strong>${clock.name}</strong>
                    <span>${getUtcOffsetLabel(clock.timezone)}</span>
                    <time>${current.hour}:${current.minute}${current.period ? ` ${current.period}` : ''}</time>
                    <small>${dayLabel}</small>
                </div>
                <div class="converter-hours">${cells}</div>
            </article>
        `;
    }).join('') + renderConverterNotes(dayStart, nowIndex);

}

function formatEventTime(date, timezone) {
    return new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    }).format(date).replace(' ', '');
}

function formatEventDate(date, timezone) {
    return new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    }).format(date);
}

function makeDateFromEventInputs(dateValue, timeValue) {
    const timezone = document.getElementById('eventTimezone')?.value || activeClocks[0]?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const safeDate = dateValue || new Date().toISOString().slice(0, 10);
    const safeTime = timeValue || '12:00';
    const [year, month, day] = safeDate.split('-').map(Number);
    const [hour, minute] = safeTime.split(':').map(Number);
    const guess = new Date(year, month - 1, day, hour, minute);
    const zonedGuess = new Date(guess.toLocaleString('en-US', { timeZone: timezone }));
    const diff = guess.getTime() - zonedGuess.getTime();
    return new Date(guess.getTime() + diff);
}

function populateEventTimezoneOptions() {
    const select = document.getElementById('eventTimezone');
    if (!select) return;
    const currentValue = select.value;
    select.innerHTML = activeClocks.map(clock => `<option value="${clock.timezone}">${clock.name} (${getUtcOffsetLabel(clock.timezone)})</option>`).join('');
    if (currentValue && activeClocks.some(clock => clock.timezone === currentValue)) {
        select.value = currentValue;
    }
}

function eventRowsMarkup(start, end, hostTimezone) {
    const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const localRow = {
        timezone: localTimezone,
        name: 'Your Time',
        location: 'On this computer / device',
        host: localTimezone === hostTimezone
    };
    const rows = activeClocks.map(clock => ({
        timezone: clock.timezone,
        name: clock.name,
        location: getCountryFromTimezone(clock.timezone),
        host: clock.timezone === hostTimezone
    }));

    if (!rows.some(row => row.timezone === localTimezone)) rows.push(localRow);

    return rows.map(row => `
        <div class="event-time-row ${row.host ? 'host' : ''}">
            <div class="event-location-cell">
                <strong>${row.name}</strong>
                <span>${row.location}</span>
            </div>
            <div class="event-time-pair">
                <div>
                    <time>${formatEventTime(start, row.timezone)}</time>
                    <small>${formatEventDate(start, row.timezone)}</small>
                </div>
                <b>-</b>
                <div>
                    <time>${formatEventTime(end, row.timezone)}</time>
                    <small>${formatEventDate(end, row.timezone)}</small>
                </div>
            </div>
        </div>
    `).join('');
}

function getStartsInLabel(start) {
    const diffMinutes = Math.max(0, Math.round((start.getTime() - Date.now()) / 60000));
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    if (hours > 0) return `<strong>${hours} hour${hours === 1 ? '' : 's'}</strong><small>${minutes} minute${minutes === 1 ? '' : 's'}</small>`;
    return `<strong>${minutes}</strong><small>minutes</small>`;
}

function eventCardMarkup(event, options = {}) {
    const start = new Date(event.startIso);
    const end = new Date(start.getTime() + Number(event.durationMinutes) * 60 * 1000);
    const removeButton = options.preview ? '' : `<button class="event-remove" data-event-id="${event.id}" type="button" aria-label="Remove ${event.name}">×</button>`;

    return `
        <div class="event-preview-card ${options.preview ? 'is-preview' : ''}">
            <div class="event-card-body">
                <div class="event-card-main">
                    <div class="event-card-title-row">
                        <span class="eyebrow">${options.preview ? 'Preview' : 'Event'}</span>
                        <h3>${event.name}</h3>
                    </div>
                    ${eventRowsMarkup(start, end, event.hostTimezone)}
                </div>
                <div class="event-countdown">
                    ${removeButton}
                    <span>Starts in</span>${getStartsInLabel(start)}
                </div>
            </div>
        </div>
    `;
}

function getEventFromForm() {
    const nameInput = document.getElementById('eventName');
    const dateInput = document.getElementById('eventDate');
    const timeInput = document.getElementById('eventTime');
    const durationInput = document.getElementById('eventDuration');
    const timezoneInput = document.getElementById('eventTimezone');
    if (!nameInput || !dateInput || !timeInput || !durationInput || !timezoneInput) return null;

    return {
        id: `event-${Date.now()}`,
        name: nameInput.value.trim() || 'Event',
        startIso: makeDateFromEventInputs(dateInput.value, timeInput.value).toISOString(),
        durationMinutes: Number(durationInput.value),
        hostTimezone: timezoneInput.value
    };
}

function renderSavedEvents() {
    const cards = document.getElementById('eventCards');
    if (!cards) return;
    cards.innerHTML = savedEvents.map(event => eventCardMarkup(event)).join('');
    cards.querySelectorAll('.event-remove').forEach(button => {
        button.addEventListener('click', () => {
            savedEvents = savedEvents.filter(event => event.id !== button.dataset.eventId);
            localStorage.setItem('savedEvents', JSON.stringify(savedEvents));
            renderSavedEvents();
            renderTimeConverter();
        });
    });
}

function handleAddEvent(event) {
    event.preventDefault();
    const eventData = getEventFromForm();
    if (!eventData) return;
    savedEvents.unshift(eventData);
    localStorage.setItem('savedEvents', JSON.stringify(savedEvents));
    renderSavedEvents();
    renderTimeConverter();
}

function renderEventPreview() {
    // Preview removed by request; saved event cards render after Add Event.
}

function pad2(value) {
    return String(value).padStart(2, '0');
}

function renderSimpleEventPickers() {
    const dateInput = document.getElementById('eventDate');
    const timeInput = document.getElementById('eventTime');
    if (!dateInput || !timeInput) return;

    const [year, month, day] = dateInput.value.split('-').map(Number);
    const [hour24, minute] = timeInput.value.split(':').map(Number);
    const hour12 = hour24 % 12 || 12;
    const period = hour24 >= 12 ? 'PM' : 'AM';

    const selectedDate = new Date(year, month - 1, day, 12, 0, 0);
    document.getElementById('eventDayDisplay').textContent = pad2(day);
    document.getElementById('eventMonthDisplay').textContent = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(selectedDate);
    document.getElementById('eventWeekdayDisplay').textContent = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(selectedDate);
    document.getElementById('eventHourDisplay').textContent = pad2(hour12);
    document.getElementById('eventMinuteDisplay').textContent = pad2(minute);
    document.getElementById('eventPeriodDisplay').textContent = period;
}

function updateEventDateInput(mutator) {
    const dateInput = document.getElementById('eventDate');
    if (!dateInput) return;
    const [year, month, day] = dateInput.value.split('-').map(Number);
    const date = new Date(year, month - 1, day, 12, 0, 0);
    mutator(date);
    dateInput.value = getDateKey(date);
    renderSimpleEventPickers();
}

function updateEventTimeInput(mutator) {
    const timeInput = document.getElementById('eventTime');
    if (!timeInput) return;
    const [hour, minute] = timeInput.value.split(':').map(Number);
    const date = new Date(2000, 0, 1, hour, minute, 0);
    mutator(date);
    timeInput.value = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
    renderSimpleEventPickers();
}

function handleSimplePickerStep(event) {
    const button = event.target.closest('[data-event-step]');
    if (!button) return;
    const step = Number(button.dataset.step);
    const action = button.dataset.eventStep;

    if (action === 'date-day') updateEventDateInput(date => date.setDate(date.getDate() + step));
    if (action === 'date-month') updateEventDateInput(date => date.setMonth(date.getMonth() + step));
    if (action === 'date-year') updateEventDateInput(date => date.setFullYear(date.getFullYear() + step));
    if (action === 'time-hour') updateEventTimeInput(date => date.setHours(date.getHours() + step));
    if (action === 'time-minute') updateEventTimeInput(date => date.setMinutes(date.getMinutes() + step));
    if (action === 'time-period') updateEventTimeInput(date => date.setHours(date.getHours() + 12));
}

function initializeEventPlanner() {
    const dateInput = document.getElementById('eventDate');
    const timeInput = document.getElementById('eventTime');
    const form = document.getElementById('eventForm');
    if (!dateInput || !timeInput || !form) return;

    dateInput.value = new Date().toISOString().slice(0, 10);
    if (!timeInput.value) timeInput.value = '12:00';
    populateEventTimezoneOptions();
    renderSimpleEventPickers();
    form.addEventListener('click', handleSimplePickerStep);
    form.addEventListener('submit', handleAddEvent);
    renderSavedEvents();
}

function updateEventPlannerOptions() {
    populateEventTimezoneOptions();
    renderEventPreview();
}

function updateClocks() {
    const now = new Date();

    // Update each clock
    activeClocks.forEach(clock => {
        // Find the clock element
        const clockElement = document.querySelector(`.clock[data-timezone="${clock.timezone}"]`);
        if (!clockElement) return;

        clockElement.classList.toggle('night-background', isNightBackgroundTime(clock.timezone));

        // Format the time for the specific timezone
        const options = {
            timeZone: clock.timezone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: !use24HourClock
        };

        const timePartsForDisplay = new Intl.DateTimeFormat('en-US', options).formatToParts(now);
        const hourDisplay = timePartsForDisplay.find(part => part.type === 'hour')?.value || '00';
        const minuteDisplay = timePartsForDisplay.find(part => part.type === 'minute')?.value || '00';
        const periodDisplay = timePartsForDisplay.find(part => part.type === 'dayPeriod')?.value || '';

        // Format the date for the specific timezone
        const dateOptions = {
            timeZone: clock.timezone,
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        };

        const datePartsForDisplay = new Intl.DateTimeFormat('en-US', dateOptions).formatToParts(now);
        const weekdayDisplay = datePartsForDisplay.find(part => part.type === 'weekday')?.value || '';
        const monthDisplay = datePartsForDisplay.find(part => part.type === 'month')?.value || '';
        const dayDisplay = datePartsForDisplay.find(part => part.type === 'day')?.value || '';

        // Update the digital flip clock display
        const timeElement = clockElement.querySelector('.time');
        ensureFlipClockMarkup(timeElement, periodDisplay);
        flipClockUnit(timeElement.querySelector('.flip-clock.hour'), hourDisplay);
        flipClockUnit(timeElement.querySelector('.flip-clock.minute'), minuteDisplay);
        clockElement.querySelector('.date').innerHTML = `<strong>${weekdayDisplay},</strong><span>${dayDisplay} ${monthDisplay}</span>`;
        clockElement.querySelector('.clock-meta-row').innerHTML = `<span>${weekdayDisplay}, ${dayDisplay} ${monthDisplay}</span><b>${getWeatherFromTimezone(clock.timezone)}</b>`;
        const ghostHour = hourDisplay;
        const ghostMinuteOne = String((Number(minuteDisplay) + 1) % 60).padStart(2, '0');
        const ghostMinuteTwo = String((Number(minuteDisplay) + 2) % 60).padStart(2, '0');
        clockElement.querySelector('.ghost-time').innerHTML = `${ghostHour}${ghostMinuteOne}<br>${ghostHour}${ghostMinuteTwo}`;

        // Update the time difference
        const timeDiff = calculateTimeDifference(clock.timezone);
        clockElement.querySelector('.time-difference').textContent = timeDiff;

        // Get time components for analog clock
        const timeParts = now.toLocaleString('en-US', {
            timeZone: clock.timezone,
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            hour12: false
        }).split(/[:\s]/);

        let hours = parseInt(timeParts[0]);
        if (timeParts.length > 3 && timeParts[3].toLowerCase() === 'pm' && hours < 12) {
            hours += 12;
        }
        const minutes = parseInt(timeParts[1]);
        const seconds = parseInt(timeParts[2]);

        // Calculate angles for clock hands
        const hourAngle = (hours % 12) * 30 + minutes * 0.5;
        const minuteAngle = minutes * 6;
        const secondAngle = seconds * 6;

        // Update analog clock hands
        const hourHand = clockElement.querySelector('.hour-hand');
        const minuteHand = clockElement.querySelector('.minute-hand');
        const secondHand = clockElement.querySelector('.second-hand');

        hourHand.style.transform = `rotate(${hourAngle}deg)`;
        minuteHand.style.transform = `rotate(${minuteAngle}deg)`;
        secondHand.style.transform = `rotate(${secondAngle}deg)`;
    });

    // Update local time in footer
    const localTimeElement = document.getElementById('localTime');
    localTimeElement.textContent = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    renderTimeConverter();
}

// Initialize the Leaflet map
let map; // Global map variable
let markerLayer; // Dedicated marker layer so deleting one clock does not wipe the map state
let markerByTimezone = new Map(); // Visible markers by timezone
let allTimezoneMarkers = new Map(); // Pre-created markers for every selectable timezone

let focusAnimationTimer;

function focusMapOnTimezone(timezone) {
    const marker = markerByTimezone.get(timezone);
    if (!map || !marker) return;

    clearTimeout(focusAnimationTimer);
    map.stop();
    map.closePopup();

    const latLng = marker.getLatLng();
    const overviewZoom = map.getMinZoom();
    const targetZoom = Math.max(4, overviewZoom + 2);

    // Always reset to an overview first, then zoom into the target pin.
    // This avoids Leaflet offset accumulation when switching between focused pins.
    map.setView([20, 0], overviewZoom, { animate: true, duration: 1.0, pan: { animate: true, duration: 1.0 } });
    focusAnimationTimer = setTimeout(() => {
        map.setView(latLng, targetZoom, { animate: true, duration: 1.35, pan: { animate: true, duration: 1.35 } });
        map.once('moveend', () => {
            map.panTo(latLng, { animate: true, duration: .45 });
            marker.openPopup();
        });
    }, 1050);
}

const lightMapTiles = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
let worldBounds;

function initializeWorldMap() {
    worldBounds = L.latLngBounds([[-85, -180], [85, 180]]);

    // Initialize the map. Bounds + noWrap prevent repeated world maps side by side.
    map = L.map('world-map', {
        minZoom: 2,
        maxBounds: worldBounds,
        maxBoundsViscosity: 1.0,
        worldCopyJump: false,
        attributionControl: false
    }).setView([20, 0], 2);

    // Always use the light basemap, including in dark app mode.
    L.tileLayer(lightMapTiles, {
        attribution: '',
        subdomains: 'abcd',
        noWrap: true,
        bounds: worldBounds
    }).addTo(map);

    markerLayer = L.featureGroup().addTo(map);
    initializeTimezoneMarkers();

    // Reveal markers for active clocks
    updateWorldMapMarkers();
    map.fitBounds(worldBounds, { padding: [10, 10], animate: false });
}

// Approximate coordinates for all selectable timezones.
// Keeping this list in sync with the dropdown ensures added clocks get map pins.
const timezoneCoordinates = {
        'America/New_York': { lat: 40.7128, lng: -74.0060 },
        'America/Chicago': { lat: 41.8781, lng: -87.6298 },
        'America/Denver': { lat: 39.7392, lng: -104.9903 },
        'America/Los_Angeles': { lat: 34.0522, lng: -118.2437 },
        'America/Toronto': { lat: 43.6532, lng: -79.3832 },
        'America/Vancouver': { lat: 49.2827, lng: -123.1207 },
        'America/Mexico_City': { lat: 19.4326, lng: -99.1332 },
        'Europe/London': { lat: 51.5074, lng: -0.1278 },
        'Europe/Paris': { lat: 48.8566, lng: 2.3522 },
        'Europe/Berlin': { lat: 52.5200, lng: 13.4050 },
        'Europe/Rome': { lat: 41.9028, lng: 12.4964 },
        'Europe/Madrid': { lat: 40.4168, lng: -3.7038 },
        'Europe/Moscow': { lat: 55.7558, lng: 37.6173 },
        'Asia/Tokyo': { lat: 35.6895, lng: 139.6917 },
        'Asia/Shanghai': { lat: 31.2304, lng: 121.4737 },
        'Asia/Hong_Kong': { lat: 22.3193, lng: 114.1694 },
        'Asia/Singapore': { lat: 1.3521, lng: 103.8198 },
        'Asia/Dubai': { lat: 25.2048, lng: 55.2708 },
        'Asia/Kolkata': { lat: 19.0760, lng: 72.8777 },
        'Asia/Seoul': { lat: 37.5665, lng: 126.9780 },
        'Australia/Sydney': { lat: -33.8688, lng: 151.2093 },
        'Australia/Melbourne': { lat: -37.8136, lng: 144.9631 },
        'Pacific/Auckland': { lat: -36.8509, lng: 174.7645 },
        'America/Sao_Paulo': { lat: -23.5558, lng: -46.6396 },
        'America/Buenos_Aires': { lat: -34.6037, lng: -58.3816 },
        'America/Santiago': { lat: -33.4489, lng: -70.6693 },
        'Africa/Cairo': { lat: 30.0444, lng: 31.2357 },
        'Africa/Johannesburg': { lat: -26.2041, lng: 28.0473 },
        'Africa/Lagos': { lat: 6.5244, lng: 3.3792 }
};

function initializeTimezoneMarkers() {
    allTimezoneMarkers = new Map();

    Object.entries(timezoneCoordinates).forEach(([timezone, coords]) => {
        const marker = L.marker([coords.lat, coords.lng]);
        allTimezoneMarkers.set(timezone, marker);
    });
}

function revealMarkerForClock(clock) {
    if (!markerLayer || !clock) return null;

    const marker = allTimezoneMarkers.get(clock.timezone);
    if (!marker) return null;

    marker.bindPopup(`${clock.name}<br>${clock.timezone}`);

    if (!markerLayer.hasLayer(marker)) {
        markerLayer.addLayer(marker);
    }

    markerByTimezone.set(clock.timezone, marker);
    return marker;
}

function hideMarkerForTimezone(timezone) {
    const marker = allTimezoneMarkers.get(timezone);
    if (marker && markerLayer.hasLayer(marker)) {
        markerLayer.removeLayer(marker);
    }
    markerByTimezone.delete(timezone);
}

// Show pins only for active clocks. All possible pins are pre-created at map init.
function updateWorldMapMarkers() {
    if (!markerLayer || !allTimezoneMarkers.size) return;

    const activeTimezones = new Set(activeClocks.map(clock => clock.timezone));

    allTimezoneMarkers.forEach((marker, timezone) => {
        if (!activeTimezones.has(timezone)) {
            hideMarkerForTimezone(timezone);
        }
    });

    activeClocks.forEach(clock => {
        revealMarkerForClock(clock);
    });
}

// Initialize the clocks container
function initializeClocks() {
    renderClockCards();
}

// Handle adding new clocks
function handleAddClock() {
    const timezoneSelect = document.getElementById('timezoneSelect');
    const customName = document.getElementById('customName');

    const selectedTimezone = timezoneSelect.value;
    if (!selectedTimezone) {
        alert('Please select a timezone');
        return;
    }

    // Check if clock already exists
    if (activeClocks.some(clock => clock.timezone === selectedTimezone)) {
        alert('This timezone is already displayed');
        return;
    }

    const selectedOption = timezoneSelect.options[timezoneSelect.selectedIndex];
    const customLabel = customName.value.trim();
    const cityName = customLabel || selectedOption.dataset.cityName || selectedOption.text;

    // Add to active clocks
    activeClocks.push({
        timezone: selectedTimezone,
        name: cityName,
        customLabel: Boolean(customLabel),
        favorite: false
    });

    // Save and re-render so favorite ordering stays consistent across cards/converter.
    saveClockPreferences();
    renderClockCards();

    // Reset form
    timezoneSelect.value = '';
    customName.value = '';
}

// Handle theme toggle
function handleThemeToggle() {
    const body = document.body;
    const themeToggle = document.getElementById('themeToggle');
    const icon = themeToggle.querySelector('i');
    const text = themeToggle.querySelector('span');

    body.classList.toggle('dark-theme');

    if (body.classList.contains('dark-theme')) {
        icon.classList.replace('fa-moon', 'fa-sun');
        text.textContent = 'Light Mode';
    } else {
        icon.classList.replace('fa-sun', 'fa-moon');
        text.textContent = 'Dark Mode';
    }
}

// Save clock preferences to localStorage
function saveClockPreferences() {
    normalizeSingleFavorite();
    localStorage.setItem('activeClocks', JSON.stringify(activeClocks));
    localStorage.setItem('theme', document.body.classList.contains('dark-theme'));
}

// Load clock preferences from localStorage
function loadClockPreferences() {
    const savedClocks = localStorage.getItem('activeClocks');
    const savedTheme = localStorage.getItem('theme');

    if (savedClocks) {
        activeClocks = JSON.parse(savedClocks);
        normalizeSingleFavorite();
    }

    if (savedTheme === 'true') {
        document.body.classList.add('dark-theme');
        const themeToggle = document.getElementById('themeToggle');
        const icon = themeToggle.querySelector('i');
        const text = themeToggle.querySelector('span');
        icon.classList.replace('fa-moon', 'fa-sun');
        text.textContent = 'Light Mode';
    }

}

// Initialize the application
function initializeApp() {
    // Load saved preferences
    loadClockPreferences();

    // Initialize controls, map, clocks and event planner
    labelTimezoneOptions();
    initializeWorldMap();
    initializeClocks();
    initializeEventPlanner();

    // Start clock updates
    updateClocks();
    setInterval(updateClocks, 1000);

    // Add event listeners
    document.getElementById('addClockBtn').addEventListener('click', handleAddClock);
    document.getElementById('themeToggle').addEventListener('click', handleThemeToggle);

    // Save preferences when closing/reloading
    window.addEventListener('beforeunload', saveClockPreferences);
}

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);
