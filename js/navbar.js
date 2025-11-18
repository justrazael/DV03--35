document.addEventListener('DOMContentLoaded', function() { //script triggers after the HTML file is loaded
  const navItems = [  //arrays to insert the text and htmls.
    ['Home', 'index.html'],
    ['1st Page', 'Page1.html'],
    ['2nd Page', 'Page2.html'],
    ['3rd Page', 'Page3.html'],
  ];

  let navHtml = '<nav id="navbar"><ul>'; //starts the navigation HTML string (ul)
  navItems.forEach(([text, href]) => {  //;loop each menu text 
    navHtml += `<li><a href="${href}">${text}</a></li>`; //Output text and href here 
  });
  navHtml += '</ul></nav>';

  document.querySelector('.nav-container').insertAdjacentHTML('beforeend', navHtml); //Insert the completed navigation into .nav-container, after the logo
});