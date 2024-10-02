document.addEventListener('DOMContentLoaded', () => {
    // Function to fetch JSON data
    function fetchJSON(url) {
        return fetch(url).then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        });
    }

    // Get the current language of the Thunderbird UI
    let userLanguage = messenger.i18n.getUILanguage();
    // Extract the base language code (e.g., 'en' from 'en-US')
    userLanguage = userLanguage.split('-')[0];

    // Define the list of supported locales
    const supportedLocales = ['en', 'de']; // Add other supported locales here

    // Determine the appropriate locale for help
    let helpLocale = 'en'; // Default to English
    if (supportedLocales.includes(userLanguage)) {
        helpLocale = userLanguage;
    }

    // Define the path to help.json
    const helpJsonUrl = messenger.runtime.getURL(`_locales/${helpLocale}/help.json`);

    // Fetch the help.json
    fetchJSON(helpJsonUrl)
        .then(data => {
            // Populate the HTML with localized strings
            document.getElementById('help-title').textContent = data.help_title;
            document.getElementById('instructions-title').textContent = data.instructions_title;
            document.getElementById('instructions-text-1').textContent = data.instructions_text_1;
            document.getElementById('instructions-text-2').textContent = data.instructions_text_2;
            document.getElementById('instructions-text-3').textContent = data.instructions_text_3;
            
            document.getElementById('usage-ideas-title').textContent = data.usage_ideas_title;
            document.getElementById('usage-idea-1-title').textContent = data.usage_idea_1_title;
            document.getElementById('usage-idea-1-text').textContent = data.usage_idea_1_text;
            document.getElementById('usage-idea-2-title').textContent = data.usage_idea_2_title;
            document.getElementById('usage-idea-2-text').textContent = data.usage_idea_2_text;
            document.getElementById('usage-idea-3-title').textContent = data.usage_idea_3_title;
            document.getElementById('usage-idea-3-text').textContent = data.usage_idea_3_text;
            
            document.getElementById('good-training-notes-title').textContent = data.good_training_notes_title;
            document.getElementById('good-training-text-1').textContent = data.good_training_text_1;
            document.getElementById('good-training-text-2').textContent = data.good_training_text_2;
            
            document.getElementById('poor-training-title').textContent = data.poor_training_title;
            document.getElementById('poor-training-text-1').textContent = data.poor_training_text_1;
            document.getElementById('poor-training-text-2').textContent = data.poor_training_text_2;
            
            document.getElementById('additional-notes-title').textContent = data.additional_notes_title;
            document.getElementById('note-1').textContent = data.note_1;
            document.getElementById('note-2').textContent = data.note_2;
            document.getElementById('note-3').textContent = data.note_3;
            
            document.getElementById('questions-title').textContent = data.questions_title;
            document.getElementById('question-1-title').textContent = data.question_1_title;
            document.getElementById('question-1-text').textContent = data.question_1_text;
            document.getElementById('question-2-title').textContent = data.question_2_title;
            document.getElementById('question-2-text').textContent = data.question_2_text;
            document.getElementById('question-3-title').textContent = data.question_3_title;
            document.getElementById('question-3-text').textContent = data.question_3_text;
        })
        .catch(error => {
            console.error('Error loading help.json:', error);
            // Fallback to English if fetching localized help.json fails
            if (helpLocale !== 'en') {
                const fallbackHelpJsonUrl = messenger.runtime.getURL('_locales/en/help.json');
                fetchJSON(fallbackHelpJsonUrl)
                    .then(data => {
                        // Populate the HTML with fallback (English) strings
                        document.getElementById('help-title').textContent = data.help_title;
                        document.getElementById('instructions-title').textContent = data.instructions_title;
                        document.getElementById('instructions-text-1').textContent = data.instructions_text_1;
                        document.getElementById('instructions-text-2').textContent = data.instructions_text_2;
                        document.getElementById('instructions-text-3').textContent = data.instructions_text_3;
                        
                        document.getElementById('usage-ideas-title').textContent = data.usage_ideas_title;
                        document.getElementById('usage-idea-1-title').textContent = data.usage_idea_1_title;
                        document.getElementById('usage-idea-1-text').textContent = data.usage_idea_1_text;
                        document.getElementById('usage-idea-2-title').textContent = data.usage_idea_2_title;
                        document.getElementById('usage-idea-2-text').textContent = data.usage_idea_2_text;
                        document.getElementById('usage-idea-3-title').textContent = data.usage_idea_3_title;
                        document.getElementById('usage-idea-3-text').textContent = data.usage_idea_3_text;
                        
                        document.getElementById('good-training-notes-title').textContent = data.good_training_notes_title;
                        document.getElementById('good-training-text-1').textContent = data.good_training_text_1;
                        document.getElementById('good-training-text-2').textContent = data.good_training_text_2;
                        
                        document.getElementById('poor-training-title').textContent = data.poor_training_title;
                        document.getElementById('poor-training-text-1').textContent = data.poor_training_text_1;
                        document.getElementById('poor-training-text-2').textContent = data.poor_training_text_2;
                        
                        document.getElementById('additional-notes-title').textContent = data.additional_notes_title;
                        document.getElementById('note-1').textContent = data.note_1;
                        document.getElementById('note-2').textContent = data.note_2;
                        document.getElementById('note-3').textContent = data.note_3;
                        
                        document.getElementById('questions-title').textContent = data.questions_title;
                        document.getElementById('question-1-title').textContent = data.question_1_title;
                        document.getElementById('question-1-text').textContent = data.question_1_text;
                        document.getElementById('question-2-title').textContent = data.question_2_title;
                        document.getElementById('question-2-text').textContent = data.question_2_text;
                        document.getElementById('question-3-title').textContent = data.question_3_title;
                        document.getElementById('question-3-text').textContent = data.question_3_text;
                    })
                    .catch(fallbackError => {
                        console.error('Error loading fallback help.json:', fallbackError);
                        // Optionally, display a default message or leave the content empty
                        popupContent.innerHTML = `<p>Help content is unavailable.</p>`;
                    });
            } else {
                // If already in English and failed, display a default message
                popupContent.innerHTML = `<p>Help content is unavailable.</p>`;
            }
        });
});
